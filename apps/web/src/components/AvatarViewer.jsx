import AvatarViewer2D from './AvatarViewer2D';

export default function AvatarViewer({
  shapeParams,
  measurements,
  sex = 'female',
  outfitItems = {},
  onItemClick,
  bodyPhotoUrl,
  skinColor,
  hair,
  showPointCloudMesh = false,
  interactive = false,
  enable3DTryOn = true,
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
      hair={hair}
      showPointCloudMesh={showPointCloudMesh}
      interactive={interactive}
      enable3DTryOn={enable3DTryOn}
    />
  );
}
