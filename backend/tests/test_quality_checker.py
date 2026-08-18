import unittest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.models.schemas import GarmentAnalysis
from app.services.reconstruction import (
    should_reconstruct,
    _build_reconstruction_prompt,
    reconstruct,
)
from app.services.vision.llm import _GARMENT_OBJECT_SCHEMA, SYSTEM_PROMPT


class TestQualityChecker(unittest.TestCase):
    def test_garment_analysis_schema_fields(self):
        """Verify GarmentAnalysis model and JSON schema include Quality Checker fields."""
        analysis = GarmentAnalysis(
            title="Black Studded Leather Jacket",
            category="Outerwear",
            image_quality_status="needs_completion",
            image_quality_reason="Lapels occluded by hair; left cuff cut by frame",
            reconstruction_prompt="Complete the missing lapels and cuff of the black studded leather jacket on off-white background",
        )
        dumped = analysis.model_dump()
        self.assertEqual(dumped["image_quality_status"], "needs_completion")
        self.assertIn("Lapels occluded", dumped["image_quality_reason"])
        self.assertIn("Complete the missing", dumped["reconstruction_prompt"])

        # Verify JSON schema properties
        props = _GARMENT_OBJECT_SCHEMA["properties"]
        self.assertIn("image_quality_status", props)
        self.assertIn("image_quality_reason", props)
        self.assertIn("reconstruction_prompt", props)
        self.assertIn("complete", props["image_quality_status"]["enum"])
        self.assertIn("needs_completion", props["image_quality_status"]["enum"])
        self.assertIn("needs_reconstruction", props["image_quality_status"]["enum"])

        # Verify system prompt has Quality Checker instructions
        self.assertIn("image_quality_status", SYSTEM_PROMPT)
        self.assertIn("needs_completion", SYSTEM_PROMPT)
        self.assertIn("needs_reconstruction", SYSTEM_PROMPT)

    def test_should_reconstruct_quality_checker(self):
        """Verify should_reconstruct respects Gemini's visual assessment."""
        with patch("app.config.settings.ENABLE_RECONSTRUCTION", True):
            # 1. Complete item -> no reconstruction
            complete_analysis = {
                "title": "Clean T-Shirt",
                "category": "Top",
                "image_quality_status": "complete",
            }
            needs, reasons = should_reconstruct(complete_analysis, [0, 0, 1000, 1000])
            self.assertFalse(needs)
            self.assertIn("quality_checker:complete", reasons)

            # 2. Needs completion -> reconstruction True with reason
            completion_analysis = {
                "title": "Voluminous Mesh Skirt",
                "category": "Bottom",
                "image_quality_status": "needs_completion",
                "image_quality_reason": "Side cut off by bag and arm",
            }
            needs, reasons = should_reconstruct(completion_analysis, None)
            self.assertTrue(needs)
            self.assertIn("quality_checker:needs_completion", reasons)
            self.assertTrue(any("Side cut off by bag and arm" in r for r in reasons))

            # 3. Needs full reconstruction -> reconstruction True with reason
            recon_analysis = {
                "title": "Patent Black Pumps",
                "category": "Footwear",
                "image_quality_status": "needs_reconstruction",
                "image_quality_reason": "Only toe caps visible; severed ankles and heels",
            }
            needs, reasons = should_reconstruct(recon_analysis, None)
            self.assertTrue(needs)
            self.assertIn("quality_checker:needs_reconstruction", reasons)
            self.assertTrue(any("Only toe caps visible" in r for r in reasons))

    def test_build_reconstruction_prompt(self):
        """Verify _build_reconstruction_prompt uses LLM prompt if available, fallback otherwise."""
        # When custom prompt is provided by Gemini
        custom_prompt = "Editorial product shot of black studded jacket with restored lapels"
        analysis_with_prompt = {
            "title": "Jacket",
            "category": "Outerwear",
            "reconstruction_prompt": custom_prompt,
        }
        self.assertEqual(_build_reconstruction_prompt(analysis_with_prompt), custom_prompt)

        # Fallback dynamic composition
        analysis_fallback = {
            "title": "Jacket",
            "category": "Outerwear",
            "color": "Black",
            "material": "Leather",
            "pattern": "solid",
        }
        fallback_prompt = _build_reconstruction_prompt(analysis_fallback)
        self.assertIn("Black Leather solid", fallback_prompt)
        self.assertIn("High-fidelity editorial product photograph", fallback_prompt)

    def test_reconstruct_routing(self):
        """Verify reconstruct routes needs_reconstruction to generate and needs_completion to edit."""
        async def _test():
            mock_service = MagicMock()
            mock_service.generate = AsyncMock(return_value={"image_b64": "gen_b64", "mime_type": "image/png", "model_used": "nano-banana"})
            mock_service.edit = AsyncMock(return_value={"image_b64": "edit_b64", "mime_type": "image/png", "model_used": "nano-banana"})

            with patch("app.services.reconstruction.gemini_image_service", mock_service), \
                 patch("app.services.background_matting.remove_background", AsyncMock(return_value={"success": False})):

                # Test needs_reconstruction -> calls generate
                recon_analysis = {
                    "title": "Patent Black Pumps",
                    "category": "Footwear",
                    "image_quality_status": "needs_reconstruction",
                    "reconstruction_prompt": "Editorial photo of black patent pumps",
                }
                res_recon = await reconstruct(b"fake_crop", recon_analysis, validate=False)
                self.assertIsNotNone(res_recon)
                self.assertEqual(res_recon["image_b64"], "gen_b64")
                mock_service.generate.assert_awaited_once()

                # Test needs_completion -> calls edit
                complete_analysis = {
                    "title": "Leather Jacket",
                    "category": "Outerwear",
                    "image_quality_status": "needs_completion",
                    "reconstruction_prompt": "Complete the leather jacket collar",
                }
                res_edit = await reconstruct(b"fake_crop", complete_analysis, validate=False)
                self.assertIsNotNone(res_edit)
                self.assertEqual(res_edit["image_b64"], "edit_b64")
                mock_service.edit.assert_awaited_once()

        asyncio.run(_test())


if __name__ == "__main__":
    unittest.main()
