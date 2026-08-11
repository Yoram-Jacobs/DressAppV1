<<<<<<< HEAD
# 导入您的衣橱 - 详细指南

## 概述

你已经在另一个应用中追踪了你的衣橱？没有问题！DressApp让导出现有的衣橱数据变得简单，这样你就不必从头开始。我们支持从各种流行的衣橱和套装规划应用中导入数据.

## 支持的导入来源

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## 详细的导入指南

### 步骤 1：打开衣橱页面
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### 步骤 2：访问导入功能
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### 步骤 3：选择源应用
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### 步骤 4：从旧的应用中导出数据
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### 步骤 5：上传到 DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### 步骤 6：回顾和调整
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## 什么会被导入

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## 故障排除

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

## 需要帮助？

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*最后更新: 2026 年 7 月*
=======
# 从其他应用导入您的衣橱（竞合迁移）

## 概述
如果您已经在其他衣橱应用（如 Whering、Acloset 或 Stylebook）中对衣服进行了分类整理，则无需从头开始。DressApp 配备了智能的 **Desktop Wardrobe Migration Agent**（通过浏览器书签小程序 bookmarklet），它可以抓取您旧的衣橱页面，捕获您的衣服卡片，并自动将其上传 to DressApp。随后，我们的 AI 会在后台自动识别衣服的颜色、品牌、面料和类别。

## 前提条件
- **台式电脑**：迁移书签小程序需要台式电脑浏览器支持（Chrome、Edge 或 Safari）。不支持移动设备或平板电脑。
- **活跃账户**：您必须在同一个浏览器中同时登录您的 DressApp 账户和竞争对手衣橱账户。
- **书签栏**：您的浏览器书签栏必须可见（Windows 上为 Ctrl+Shift+B，macOS 上为 Cmd+Shift+B）。

## 逐步指南
1. 在您的台式电脑上打开 DressApp **Profile**（个人资料）页面，然后点击 **Import Wardrobe**。
2. 从列表中选择您旧的应用（Whering、Acloset、Stylebook、Smartli、BeautyAI 等）或输入自定义名称。
3. 将屏幕上的 **Share & Start Agent** 书签小程序按钮直接拖动到浏览器的书签栏中。
4. 打开一个新标签页，导航到您旧衣橱应用的网页版并登录。转到展示您所有衣服网格的页面。
5. 点击书签栏中的 **Share & Start Agent** 书签小程序。
6. 代理将开始滚动页面、检测衣服图片，并以 15 件为一批的形式将其传输到 DressApp。在此过程中请勿关闭 DressApp 标签页。
7. 传输完成后，请检查您的 DressApp Closet（衣橱）页面。AI Stylist 将在后台处理这些物品，以自动填入衣服属性。

## 预期结果
- 衣服卡片将立即出现在您的 DressApp 衣橱网格中。
- 背景会被自动去除，保留干净透明的缩略图。
- 标签字段（类别、颜色、版型、面料）将在导入后几分钟内自动填充。

## 故障排除
- **书签小程序无法安装**：请确保已启用浏览器的书签栏。如果安全设置阻止了拖动操作，请右键点击该按钮，选择“复制链接地址”，手动创建一个新书签，然后将代码粘贴到 URL 字段中。
- **代理停止滚动**：确保竞争对手的衣橱页面处于活动状态且未最小化。如果停滞，请刷新竞争对手页面并再次点击该书签小程序。
- **重复物品**：导入程序会检查图像特征（dHash）以自动过滤重复上传。

## 限制
- **仅限台式电脑**：由于 API 限制，无法在移动浏览器上运行。
- **视觉清晰度**：竞争对手应用上严重变形、黑暗或重叠的衣服布局可能会导致视觉裁剪提取失败，之后需要手动调整照片。
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad
