import { client } from './client';

export const getOpenTryOnStatus = async () => {
  const { data } = await client.get('/tryon/status');
  return data;
};

export const generateGarment3D = async ({ garmentId, imageUrl, category, title }) => {
  const { data } = await client.post('/tryon/generate-3d', {
    garment_id: garmentId,
    image_url: imageUrl,
    category,
    title,
  });
  return data;
};

export const runOpenTryOnVTON = async ({ personImageUrl, garments, measurements, model }) => {
  const { data } = await client.post('/tryon/vton', {
    person_image_url: personImageUrl,
    garments,
    measurements,
    model,
  });
  return data;
};
