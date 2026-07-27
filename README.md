# allergen-search

寻找过敏源单页面应用，用于记录物品名称、数量和单位。

## 功能

- 顶部搜索框按名称筛选过敏源相关物品
- 瀑布流展示物品名称、数量和单位
- 点击新增按钮弹窗创建物品
- 表单支持名称、数量、单位选择
- 右上角齿轮保留主题、导入、导出、回收站和重置数据
- 备份 JSON 使用过敏源数据结构并保存在浏览器 localStorage

## 开发

```bash
pnpm install
pnpm run dev
```

## 打包

```bash
pnpm run build
```

构建产物输出到 `docs/`，可用于 GitHub Pages。
