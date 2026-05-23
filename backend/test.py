import asyncio, sys; sys.path.append('c:\\DressApp_AG\\backend'); from app.services.vision import GarmentVisionService
async def main():
    service = GarmentVisionService()
    with open('c:\\DressApp_AG\\inference-server\\eyes\\Garments\\tshirt.jpg', 'rb') as f:
        print(await service._gatekeep_image(f.read()))
asyncio.run(main())
