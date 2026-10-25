# Diagram Popup — Native Window Fork

Fork of [gitcpy/obsidian-diagram-popup](https://github.com/gitcpy/obsidian-diagram-popup), retaining the original MIT license and author attribution.

## 原生独立窗口版 / Native windows (0.3.0)

桌面端点击图表上的放大按钮，或 Ctrl/Cmd + 单击图表，默认在 **Obsidian 原生独立窗口**中查看。可以移动到旁边或第二块屏幕，一边看图，一边在主窗口编辑笔记。窗口使用 Obsidian 原生标题栏和工作区视图，不创建遮罩，也不设为置顶。

- 保留笔记内图表的最大高度设置，支持 Mermaid 和原有自定义目标。
- 独立窗口支持鼠标滚轮缩放、左键拖动、方向按钮平移。
- `Fit` 适应窗口；`100%` 恢复图表原始尺寸；`Close` 关闭预览。
- 画布聚焦后，`+` / `-` 缩放，`0` 适应窗口。
- 原生视图可由 Obsidian 工作区管理；可以同时打开多个图表窗口。
- 设置中的 `Preview mode` 可切换回 `Popup overlay (legacy)`；移动端始终使用浮层。
- 原生模式按窗口尺寸自动适配；旧的 Popup Size Init、背景透明度、模糊设置只影响浮层模式。

**当前为打开时的图表快照**：编辑正文不会关闭预览；修改图表后需重新打开预览以刷新。重启 Obsidian 后需从笔记重新打开，图表 HTML 不写入工作区配置。Canvas/WebGL 等依赖运行时绘制的自定义目标不在当前快照支持范围。

### 手动安装

要求 Obsidian **1.6.6 或更新版本**。下载本版本的 `main.js`、`manifest.json`、`styles.css`（或解压安装包），放入笔记库目录：

```text
<vault>/.obsidian/plugins/mermaid-popup/
    main.js
    manifest.json
    styles.css
```

重载 Obsidian，在“设置 → 第三方插件”启用 Diagram Popup。插件 ID 保持 `mermaid-popup`，因此这是对原插件的替换，不应与原版同时安装；更新前可备份该目录，保留已有 `data.json` 设置。

### 开发与验证

```sh
npm install
npm run typecheck
npm test
npm run build
```

也可使用 `pnpm install --frozen-lockfile` 和对应的 `pnpm` 命令。构建产物位于 `dist/`。API 类型固定为 Obsidian 1.6.6；Rollup 已加入显式开发依赖。

自动化测试使用模拟 Obsidian API 和 DOM，覆盖 SVG 原始尺寸与 Mermaid 标签保留、原图不变、缩放/平移/适配/关闭/事件清理、原生窗口路由、移动端兼容、打开失败清理，以及多个笔记的观察与断开。**这些检查不等同于真实 Obsidian 实机验证。**

实机验收步骤：
1. 在阅读模式和实时预览模式分别打开 Mermaid 图表，确认出现原生独立窗口。
2. 把窗口移到旁边，返回主窗口连续输入文字，确认两边可同时使用。
3. 试用滚轮、拖动、方向按钮、Fit、100%、窗口缩放和关闭。
4. 打开两个不同图表，关闭源笔记，确认预览仍可查看；关闭其中一个预览不影响另一个。
5. 在原生弹出笔记窗口中打开图表，检查按钮和放大是否正常。
6. 用正在使用的主题、自定义 CSS、PlantUML/Graphviz 渲染插件做兼容性检查。
7. 关闭/禁用插件并重启，确认无残余预览与重复按钮；切换旧浮层模式检查兼容。

---

## Upstream README

A plugin for obsidian. Show diagrams, from mermaid, plantuml, graphviz and so on, in a draggable and zoomable popup. 

- Demo
### Demo :
[View demo](https://github.com/user-attachments/assets/b6015c77-17e0-4c79-9d85-eca961bbd329)

- Install

You could get it from the BRAT plugin which you could download from the comunity plugins in obsidian. 

Other ways to be added...

After installed the BRAT plugin, go to the settings, and click "Commuity Plugins", then go the "Installed Plugins" list. 

Click the "Options" button of BRAT plugin, and then click "Add Beta plugin", 

just fill in the textbox with the url "https://github.com/gitcpy/obsidian-diagram-popup",

Click "Add Plugin", A fews seconds later, the installing will be completed.

- Usage
  
  - Open the popup
    
    If there is diagram in the markdown file, open the popup up with `ctrl`+`left click`, or click the open buttn on top.
    
    <img src='https://github.com/gitcpy/obsidian-diagram-pop/blob/main/gifs/use-click-open-button-s.png' />
    
  - Popup operation
    
    <img src='https://github.com/gitcpy/obsidian-diagram-pop/blob/main/gifs/use-oper-popup-s.png' />
    
    It is easy to operate the popup. 
 
    - Use mouse on PC
      
      Zoom out or zoom in by wheel

      Drag by holding left click
      
    - Use touching on mobile
      
      Zoom out or zoom in by touching with two fingers
      
      Drag by touching and moving with one finger
 
    - Use UI buttons
      
      No matter on PC or mobile, You can do it by 7 UI keys in the popup as follows:
      
      <code>+</code> : zoom in
        
      <code>-</code> : zoom out
        
      <code>←</code>  : move left
    
      <code>→</code>  : move ight
      
      <code>↑</code>  : move up
    
      <code>↓</code>  : move down
    
      <code>x</code>  : close

- Settings
  
  <img src='https://github.com/gitcpy/obsidian-diagram-pop/blob/main/gifs/setting-s.png' />
  
    These settings are for the users to custom the plugin.

- Example 

  - Add Image

    1. Press **shift + ctrl + i** to find target class Name and add it to settings.
       
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-1-find%20class%20name.jpg' height="600" />

    3. This example is for image. Because the target, the image element, is not a container, and its container is at the upper level, please check the container checkobx.
       But don't if the target is a container keep the core element.
       
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-2-1-add%20class%20name%20to%20setting.jpg' />
      
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-2-2-add%20class%20name%20to%20setting.jpg' />

    4. We could see the open popup button after the md file reopen.
       
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-7-button%20pos%20before%20setting.jpg' />
      
          Here is the image in the popup.
    
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-4-img%20in%20popup.jpg' height='400' />

    5. Set image max height in md tab win.
       
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-5-max%20height.jpg' />
       
           After setting.
       
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-6-image%20matches%20the%20max%20height.jpg' height='400' />

    7. Set the open button position.
       
           Settinggs
       
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-8-settings%20of%20button%20pos.jpg' />
       
           After setting
       
          <img src='https://github.com/gitcpy/obsidian-diagram-popup/blob/main/gifs/eg-1-9-button%20pos%20after%20settings.jpg'  />
       
