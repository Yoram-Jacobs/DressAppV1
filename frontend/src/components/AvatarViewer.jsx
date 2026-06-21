import AvatarViewer2D from './AvatarViewer2D';

export default function AvatarViewer({ shapeParams, sex = 'female', outfitItems = {}, onItemClick }) {
  return (
    <AvatarViewer2D
      shapeParams={shapeParams}
      sex={sex}
      outfitItems={outfitItems}
      onItemClick={onItemClick}
    />
  );
}
