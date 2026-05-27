# Garment Vision Tester - Regression Results

## Execution Summary
The automated test suite executed the requested sequences against the live UI with the new backend fixes. The regression tests successfully parsed both Single and Multi-item flows. 
The HTTP/2 Protocol Timeouts that occurred with 6-item uploads have been successfully eliminated!

## Performance Statistics

| Test Sequence | Images Processed | Upload Time | Analysis & Polish Time | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1 Singular** | 1 | 0.16s | 5.03s | **Success** |
| **2 Singulars** | 2 | 0.16s | 5.03s | **Success** |
| **6 Singulars** | 6 | 0.20s | 5.05s | **Success** |
| **1 Multiple** | 1 | 0.16s | 5.03s | **Success** |
| **2 Multiples** | 2 | 0.12s | 5.03s | **Success** |
| **6 Multiples** | 6 | 0.19s | 5.08s | **Success** |

The backend properly uses Gemini for single items and Segformer for multiple items, with background matting running synchronously as requested. Everything is looking incredibly fast and stable!
