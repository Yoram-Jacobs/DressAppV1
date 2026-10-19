import AvatarViewer2D from './AvatarViewer2D';

export default function AvatarViewer({
  shapeParams,
  measurements,
  sex = 'female',
  outfitItems = {},
  onItemClick,
  bodyPhotoUrl,
  skinColor,
  showPointCloudMesh = false
}) {
  return (
    <AvatarViewer2D
      shapeParams={shapeParams}
      measurements={measurements}
      sex={sex}
      outfitItems={outfitItems}
      onItemClick={onItemClick}
      bodyPhotoUrl={bodyPhotoUrl}
      skinColor={skinColor}
      showPointCloudMesh={showPointCloudMesh}
    />
  );
}
