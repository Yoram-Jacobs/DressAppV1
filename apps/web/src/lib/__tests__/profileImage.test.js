import { fileToDataUrl } from '../profileImage';

describe('profileImage', () => {
  let originalFileReader;
  let originalImage;
  let originalCreateElement;

  beforeAll(() => {
    originalFileReader = window.FileReader;
    originalImage = window.Image;
    originalCreateElement = document.createElement;
  });

  afterAll(() => {
    window.FileReader = originalFileReader;
    window.Image = originalImage;
    document.createElement = originalCreateElement;
  });

  test('fileToDataUrl reads file and resolves with canvas data url', async () => {
    const dummyDataUrl = 'data:image/jpeg;base64,mockeddata';
    const mockFileReader = {
      readAsDataURL: jest.fn(function() {
        this.result = dummyDataUrl;
        if (this.onload) this.onload();
      }),
    };
    window.FileReader = jest.fn(() => mockFileReader);

    const mockImage = {};
    window.Image = jest.fn(() => {
      setTimeout(() => {
        mockImage.width = 100;
        mockImage.height = 100;
        if (mockImage.onload) mockImage.onload();
      }, 0);
      return mockImage;
    });

    const mockCanvas = {
      getContext: jest.fn(() => ({
        drawImage: jest.fn(),
      })),
      toDataURL: jest.fn(() => 'data:image/jpeg;base64,resizedmockeddata'),
    };
    document.createElement = jest.fn((tag) => {
      if (tag === 'canvas') return mockCanvas;
      return {};
    });

    const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
    const result = await fileToDataUrl(file, 50);

    expect(result).toBe('data:image/jpeg;base64,resizedmockeddata');
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file);
    expect(document.createElement).toHaveBeenCalledWith('canvas');
  });
});
