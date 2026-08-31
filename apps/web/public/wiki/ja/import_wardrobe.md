<<<<<<< HEAD
# ワードローブをインポートする - 詳細ガイド

## 概要

すでに別のアプリでワードローブを管理していますか？問題ありません！DressAppを使用すると、既存のワードローブデータを簡単にインポートでき、最初からやり直す必要がありません。幅広い人気のあるワードローブ管理アプリやスタイリングアプリからのインポートをサポートしています.

## サポートされているインポート元

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## ステップ・バイ・ステップのインポートガイド

### ステップ1: クローゼットページを開く
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### ステップ2: インポート機能にアクセスする
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### ステップ3: ソースアプリを選択する
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### ステップ4: 古いアプリからデータをエクスポートする
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### ステップ5: DressAppにアップロードする
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### ステップ6: レビューして調整する
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## インポートされるもの

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## トラブルシューティング

### Import Failed
- Check that the file format is correct (CSV, JSON, or app-specific format)
- Ensure the file isn't corrupted or too large
- Try exporting again from the source app

### Missing Items After Import
- Some fields may not have mapped correctly
- Check the import results page for warnings
- Manually add missing items if needed

### Images Not Imported
- Not all apps include images in their export files
- You can add images manually to imported items later
- Use the camera or upload function on the item detail page

## 助けが必要ですか？

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*最終更新日: 2026年7月*
=======
# 他のアプリからワードローブをインポートする（競合アプリからの移行）

## 概要
すでに他のワードローブアプリ（Whering、Acloset、Stylebookなど）で洋服を登録している場合でも、最初からやり直す必要はありません。DressAppには、スマートな **Desktop Wardrobe Migration Agent**（ブラウザブックマークレット経由）が搭載されています。このエージェントが以前のクローゼットページをクロールしてアイテムカードを取得し、DressAppへ自動的にアップロードします。アップロード後は、AIがバックグラウンドで洋服の色、ブランド、素材、カテゴリを自動的に識別します。

## 前提条件
- **デスクトップコンピュータ**：移行ブックマークレットの実行には、デスクトップブラウザの機能（Chrome, Edge, またはSafari）が必要です。モバイルデバイスやタブレットには対応していません。
- **アクティブなアカウント**：同一のブラウザ上で、DressAppアカウントと移行元のワードローブアプリのアカウントの両方にログインしている必要があります。
- **ブックマークバー**：ブラウザのブックマークバーが表示されている必要があります（Windowsの場合は Ctrl+Shift+B、macOSの場合は Cmd+Shift+B）。

## ステップバイステップの手順
1. デスクトップコンピュータでDressAppの **Profile**（プロフィール）ページを開き、**Import Wardrobe** をクリックします。
2. リストから以前使用していたアプリ（Whering, Acloset, Stylebook, Smartli, BeautyAIなど）を選択するか、カスタム名を入力します。
3. 画面上の **Share & Start Agent** ブックマークレットボタンを、ブラウザのブックマークバーに直接ドラッグします。
4. 新しいタブを開き、以前のワードローブアプリのウェブ版に移動してログインします。すべての衣類アイテムがグリッド状に表示されているページを開いてください。
5. ブックマークバーにある **Share & Start Agent** ブックマークレットをクリックします。
6. エージェントがスクロールを開始し、衣類の画像を検出して、15着ずつのバッチでDressAppにストリーミング送信します。この処理中はDressAppのタブを閉じないでください。
7. ストリーミング送信が完了したら、DressApp of Closet（クローゼット）ページを確認します。AI Stylistがバックグラウンドでアイテムを処理し、衣類の属性を自動的に入力します。

## 期待される結果
- 衣類カードがDressAppのクローゼットグリッドに即座に表示されます。
- 背景は自動的に削除され、きれいな透明背景のサムネイルが作成されます。
- インポート後数分以内に、タグフィールド（カテゴリ、色、フィット感、素材）が自動的に入力されます。

## トラブルシューティング
- **ブックマークレットがインストールできない場合**：ブラウザのブックマークバーが有効になっていることを確認してください。セキュリティ設定によりドラッグできない場合は、ボタンを右クリックして「リンクのアドレスをコピー」を選択し、手動で新しいブックマークを作成してURLフィールドにコードを貼り付けてください。
- **エージェントのスクロールが停止した場合**：移行元アプリのクローゼットページがアクティブであり、最小化されていないことを確認してください。動作が停止した場合は、移行元のページを更新し、再度ブックマークレットをクリックしてください。
- **重複アイテムが発生した場合**：インポート機能が画像のシグネチャ（dHash）をチェックし、重複したアップロードを自動的にフィルタリングします。

## 制限事項
- **デスクトップ専用**：APIの制限により、モバイルブラウザでは実行できません。
- **画像の鮮明さ**：移行元アプリで衣類レイアウトが著しく歪んでいたり、暗かったり、重なり合っていたりする場合、画像の切り出し抽出に失敗することがあります。その場合は、後で手動で写真を調整する必要があります。
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad
