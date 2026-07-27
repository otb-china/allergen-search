<template>
  <div class="home-page" :style="themeStyle">
    <div class="sticky-panel">
      <header class="page-header">
        <div>
          <p class="hero-tag">Warehouse</p>
          <h1>库房</h1>
        </div>
        <div class="header-actions">
          <button v-if="showScrollTop" class="header-icon" type="button" @click="scrollToTop">
            <el-icon><Top /></el-icon>
          </button>
          <button class="header-icon" type="button" @click="settingsPopup = true">
            <el-icon><Setting /></el-icon>
          </button>
        </div>
      </header>

      <section class="search-section" aria-label="搜索和新增">
        <label class="search-box">
          <el-icon><Search /></el-icon>
          <input v-model.trim="keyword" type="search" placeholder="搜索库房物品" />
        </label>
        <button class="create-button" type="button" @click="openEditor()">
          <el-icon><Plus /></el-icon>
          新增
        </button>
      </section>
    </div>

    <main class="warehouse-view">
      <section v-if="filteredItems.length" class="waterfall-list" aria-label="库房物品列表">
        <article
          v-for="(item, index) in filteredItems"
          :key="item.id"
          class="warehouse-card"
          :class="`tone-${index % 5}`"
          @click="openEditor(item)"
        >
          <button class="delete-btn" type="button" aria-label="移入回收站" @click.stop="removeItem(item.id)">×</button>
          <h2>{{ item.name }}</h2>
          <p class="quantity-line">{{ formatQuantity(item.quantity) }}{{ item.unit }}</p>
        </article>
      </section>

      <div v-else class="empty-state">
        <strong>{{ keyword ? "没有匹配物品" : "还没有物品" }}</strong>
        <span>{{ keyword ? "换个关键词试试。" : "点击新增创建第一个库房物品。" }}</span>
      </div>
    </main>

    <van-popup v-model:show="editorPopup" class="edit-popup" round destroy-on-close>
      <form class="simple-editor" @submit.prevent="saveItem">
        <div class="editor-title">
          <strong>{{ editingItemId ? "编辑物品" : "新增物品" }}</strong>
          <span>填写名称、数量和单位</span>
        </div>

        <label class="field-row">
          <span>名称</span>
          <input v-model.trim="itemForm.name" class="simple-input" placeholder="例如：矿泉水" />
        </label>

        <label class="field-row">
          <span>数量</span>
          <input
            v-model.number="itemForm.quantity"
            class="simple-input"
            inputmode="decimal"
            type="number"
            min="0"
            step="0.01"
            placeholder="例如：12"
          />
        </label>

        <div class="field-row">
          <span>单位</span>
          <div class="unit-grid" role="radiogroup" aria-label="单位">
            <button
              v-for="unit in units"
              :key="unit"
              class="unit-option"
              :class="{ active: itemForm.unit === unit }"
              type="button"
              role="radio"
              :aria-checked="itemForm.unit === unit"
              @click="itemForm.unit = unit"
            >
              {{ unit }}
            </button>
          </div>
        </div>

        <div class="simple-actions">
          <button class="cancel-btn" type="button" @click="editorPopup = false">取消</button>
          <button class="confirm-btn" type="submit">保存</button>
        </div>
      </form>
    </van-popup>

    <SettingsPopup
      v-model:show="settingsPopup"
      :theme-options="themeOptions"
      :current-theme="currentTheme"
      :current-theme-name="currentThemeOption.name"
      :recycle-count="deletedItems.length"
      @set-theme="setTheme"
      @export="exportAllData"
      @open-import="openImportExport"
      @open-recycle="openRecycleBin"
      @reset="resetAllData"
    />

    <van-popup v-model:show="recyclePopup" position="bottom" round destroy-on-close>
      <div class="popup-body recycle-popup">
        <div class="popup-head">
          <div>
            <h3>回收站</h3>
            <p>移除的物品保留 7 天，可在这里恢复。</p>
          </div>
        </div>

        <div v-if="deletedItems.length" class="recycle-list">
          <div v-for="item in deletedItems" :key="item.id" class="recycle-item">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ formatQuantity(item.quantity) }}{{ item.unit }} · {{ getRecycleDaysLeft(item) }} 天后清除</span>
            </div>
            <div class="recycle-actions">
              <button type="button" @click="restoreDeletedItem(item.id)">恢复</button>
              <button class="danger" type="button" @click="purgeDeletedItem(item.id)">删除</button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state compact">
          <strong>回收站为空</strong>
          <span>移除的物品会在这里保留一周。</span>
        </div>
      </div>
    </van-popup>

    <ImportDataPopup
      v-model:show="importExportInfo.show"
      :has-overwrite-data="hasImportOverwriteData"
      :summary="importExportSummary"
      :file-name="importInfo.fileName"
      :has-file="Boolean(importInfo.dataStr)"
      @file-loaded="onImportFileLoaded"
      @file-error="showToast"
      @import="importData"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import { showConfirmDialog, showToast } from "vant";
import { Plus, Search, Setting, Top } from "@element-plus/icons-vue";
import ImportDataPopup from "@/components/ImportDataPopup.vue";
import SettingsPopup from "@/components/SettingsPopup.vue";
import { DEFAULT_THEME, isThemeKey, themeOptions } from "@/config/themes";
import { LStorage } from "@/utils/localStorage.ts";
import type { ThemeKey } from "@/config/themes";
import type { DeletedWarehouseItem, WarehouseBackupData, WarehouseItem } from "@/types/tool";

const SCROLL_TOP_THRESHOLD = 240;
const DATE_FORMAT = "YYYY-MM-DD";
const RECYCLE_KEEP_DAYS = 7;
const RECYCLE_KEEP_MS = RECYCLE_KEEP_DAYS * 24 * 60 * 60 * 1000;
const units = ["个", "只", "支", "根", "袋", "瓶", "条", "米", "张", "箱", "盒", "包", "件", "卷", "套", "片"] as const;
type Unit = typeof units[number];

const showScrollTop = ref(false);
const currentTheme = ref<ThemeKey>(DEFAULT_THEME);
const items = ref<WarehouseItem[]>([]);
const deletedItems = ref<DeletedWarehouseItem[]>([]);
const keyword = ref("");
const settingsPopup = ref(false);
const recyclePopup = ref(false);
const editorPopup = ref(false);
const editingItemId = ref("");
const itemForm = reactive({ name: "", quantity: 1, unit: "个" as Unit });
const importExportInfo = ref({ show: false });
const importInfo = ref({ dataStr: "", fileName: "" });

const itemStorage = LStorage.new("warehouseItems");
const recycleStorage = LStorage.new("warehouseRecycleBin");
const themeStorage = LStorage.new("warehouseTheme");

const currentThemeOption = computed(() => {
  return themeOptions.find((theme) => theme.key === currentTheme.value) || themeOptions[0];
});
const themeStyle = computed(() => currentThemeOption.value.variables);
const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return items.value;
  return items.value.filter((item) => item.name.toLowerCase().includes(query));
});
const importExportSummary = computed(() => `导入后将覆盖 ${items.value.length} 个物品`);
const hasImportOverwriteData = computed(() => items.value.length > 0);

watch(items, saveItems, { deep: true });
watch(deletedItems, saveDeletedItems, { deep: true });

function init() {
  const storedTheme = themeStorage.getter();
  currentTheme.value = isThemeKey(storedTheme) ? storedTheme : DEFAULT_THEME;
  items.value = normalizeItems(itemStorage.getter());
  deletedItems.value = purgeExpiredDeletedItems(normalizeDeletedItems(recycleStorage.getter()));
}

function createItem(name: string, quantity: number, unit: string): WarehouseItem {
  return {
    id: createId("item"),
    name,
    quantity,
    unit,
    updatedAt: new Date().toISOString(),
  };
}

function createId(prefix = "id") {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeItems(value: unknown): WarehouseItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Partial<WarehouseItem> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : createId("item"),
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "未命名物品",
      quantity: normalizeQuantity(item.quantity),
      unit: isUnit(item.unit) ? item.unit : "个",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    }));
}

function normalizeDeletedItems(value: unknown): DeletedWarehouseItem[] {
  if (!Array.isArray(value)) return [];
  return normalizeItems(value).map((item, index) => {
    const raw = value[index] as Partial<DeletedWarehouseItem>;
    return {
      ...item,
      deletedAt: typeof raw.deletedAt === "string" ? raw.deletedAt : new Date().toISOString(),
    };
  });
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
}

function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (units as readonly string[]).includes(value);
}

function saveItems() {
  if (items.value.length) {
    itemStorage.setter(items.value);
  } else {
    itemStorage.remove();
  }
}

function saveDeletedItems() {
  if (deletedItems.value.length) {
    recycleStorage.setter(deletedItems.value);
  } else {
    recycleStorage.remove();
  }
}

function setTheme(theme: ThemeKey) {
  currentTheme.value = theme;
  themeStorage.setter(theme);
}

function openEditor(item?: WarehouseItem) {
  editingItemId.value = item?.id || "";
  itemForm.name = item?.name || "";
  itemForm.quantity = item?.quantity ?? 1;
  itemForm.unit = isUnit(item?.unit) ? item.unit : "个";
  editorPopup.value = true;
}

function saveItem() {
  const name = itemForm.name.trim();
  const quantity = normalizeQuantity(itemForm.quantity);
  if (!name) {
    showToast("请填写名称");
    return;
  }

  if (editingItemId.value) {
    items.value = items.value.map((item) => item.id === editingItemId.value ? {
      ...item,
      name,
      quantity,
      unit: itemForm.unit,
      updatedAt: new Date().toISOString(),
    } : item);
  } else {
    items.value = [createItem(name, quantity, itemForm.unit), ...items.value];
  }

  editorPopup.value = false;
  showToast("已保存");
}

function removeItem(id: string) {
  const target = items.value.find((item) => item.id === id);
  if (!target) return;
  showConfirmDialog({
    title: "移入回收站",
    message: `确认将“${target.name}”移入回收站吗？`,
    width: "280px",
  }).then(() => {
    const deletedItem = {
      ...target,
      deletedAt: new Date().toISOString(),
    };
    items.value = items.value.filter((item) => item.id !== id);
    deletedItems.value = [deletedItem, ...deletedItems.value.filter((item) => item.id !== id)];
    showToast("已移入回收站");
  }).catch(() => {});
}

function openRecycleBin() {
  deletedItems.value = purgeExpiredDeletedItems(deletedItems.value);
  settingsPopup.value = false;
  recyclePopup.value = true;
}

function purgeExpiredDeletedItems(list: DeletedWarehouseItem[]) {
  const now = Date.now();
  return list.filter((item) => now - new Date(item.deletedAt).getTime() < RECYCLE_KEEP_MS);
}

function getRecycleDaysLeft(item: DeletedWarehouseItem) {
  const deletedTime = new Date(item.deletedAt).getTime();
  const leftMs = Math.max(0, RECYCLE_KEEP_MS - (Date.now() - deletedTime));
  return Math.max(1, Math.ceil(leftMs / (24 * 60 * 60 * 1000)));
}

function restoreDeletedItem(id: string) {
  const deletedItem = deletedItems.value.find((item) => item.id === id);
  if (!deletedItem) return;
  const { deletedAt: _deletedAt, ...restoredItem } = deletedItem;
  items.value = [{
    ...restoredItem,
    id: items.value.some((item) => item.id === restoredItem.id) ? createId("item") : restoredItem.id,
    updatedAt: new Date().toISOString(),
  }, ...items.value];
  deletedItems.value = deletedItems.value.filter((item) => item.id !== id);
  recyclePopup.value = false;
  showToast("物品已恢复");
}

function purgeDeletedItem(id: string) {
  deletedItems.value = deletedItems.value.filter((item) => item.id !== id);
  showToast("已彻底删除");
}

function openImportExport() {
  settingsPopup.value = false;
  importInfo.value.dataStr = "";
  importInfo.value.fileName = "";
  importExportInfo.value.show = true;
}

function exportAllData() {
  const backupText = JSON.stringify({ items: items.value, deletedItems: deletedItems.value }, null, 2);
  const blob = new Blob([backupText], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = `warehouse-backup-${dayjs(new Date()).format(DATE_FORMAT)}.json`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
  settingsPopup.value = false;
  showToast("备份文件已导出");
}

function onImportFileLoaded(payload: { dataStr: string; fileName: string }) {
  importInfo.value.dataStr = payload.dataStr;
  importInfo.value.fileName = payload.fileName;
  showToast("备份文件已读取");
}

function importData() {
  try {
    const parsedData = JSON.parse(importInfo.value.dataStr) as WarehouseBackupData;
    if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) {
      throw new Error("Invalid backup data");
    }
    const importedItems = normalizeItems(parsedData.items);
    const importedDeletedItems = normalizeDeletedItems(parsedData.deletedItems);
    if (!Array.isArray(parsedData.items) || importedItems.length !== parsedData.items.length) {
      throw new Error("Invalid items");
    }
    items.value = importedItems;
    deletedItems.value = importedDeletedItems;
    importExportInfo.value.show = false;
    importInfo.value.dataStr = "";
    importInfo.value.fileName = "";
    showToast("总数据导入成功");
  } catch {
    showToast("导入失败，请检查备份文件");
  }
}

function resetAllData() {
  showConfirmDialog({
    title: "提示",
    message: "确认清除所有库房数据吗？",
    width: "250px",
  }).then(() => {
    items.value = [];
    deletedItems.value = [];
    itemStorage.remove();
    recycleStorage.remove();
    settingsPopup.value = false;
    showToast("数据已重置");
  }).catch(() => {});
}

function getItemInitial(name: string) {
  return name.trim().slice(0, 1) || "库";
}

function formatQuantity(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateScrollTopVisibility() {
  showScrollTop.value = window.scrollY > SCROLL_TOP_THRESHOLD;
}

init();

onMounted(() => {
  updateScrollTopVisibility();
  window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", updateScrollTopVisibility);
});
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  padding: 12px;
  background:
    radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 32%),
    radial-gradient(circle at 92% 10%, rgba(255, 143, 61, 0.16), transparent 28%),
    var(--page-bg);
  color: var(--text-main);
}

.home-page,
.home-page * {
  box-sizing: border-box;
}

.warehouse-view {
  width: min(100%, 780px);
  margin: 0 auto;
}

.sticky-panel {
  position: sticky;
  top: 0;
  z-index: 20;
  margin: -12px -12px 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface) 88%, transparent) 0%,
      color-mix(in srgb, var(--surface) 88%, transparent) 56%,
      color-mix(in srgb, var(--page-bg) 94%, #ffffff) 57%,
      color-mix(in srgb, var(--page-bg) 90%, #ffffff) 86%,
      color-mix(in srgb, var(--page-bg) 0%, transparent) 100%
    );
  box-shadow: var(--header-shadow);
  backdrop-filter: blur(14px);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 18px max(18px, calc((100vw - 780px) / 2 + 18px)) 16px;
}

.hero-tag {
  margin: 0 0 4px;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 44px;
  line-height: 1.08;
  letter-spacing: -0.08em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 999px;
  background: var(--header-icon-bg);
  color: var(--accent);
  font-size: 18px;
}

.search-section {
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  width: min(100%, 780px);
  margin: 0 auto;
  padding: 14px 4px 16px;
}

.search-section::before {
  content: none;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  height: 50px;
  padding: 0 15px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 18px;
  color: var(--accent);
  background: color-mix(in srgb, var(--surface) 96%, #ffffff);
  box-shadow: var(--shadow);
}

.search-box input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--text-main);
  background: transparent;
  font-size: 16px;
  font-weight: 800;
}

.search-box input::placeholder {
  color: var(--text-muted);
}

.create-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 92px;
  height: 50px;
  padding: 0 12px;
  border: 0;
  border-radius: 18px;
  color: #ffffff;
  background: var(--create-btn-bg);
  box-shadow: var(--create-btn-shadow);
  font-size: 15px;
  font-weight: 900;
}

.waterfall-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  padding: 4px 4px 120px;
}

.warehouse-card {
  position: relative;
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px 36px 14px 14px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 18px;
  background: linear-gradient(145deg, #ffffff 0%, #eef8f6 100%);
  box-shadow: 0 10px 22px rgba(38, 56, 88, 0.07);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.warehouse-card:active {
  transform: scale(0.98);
}

.warehouse-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(38, 56, 88, 0.11);
}

.tone-1 {
  background: linear-gradient(145deg, #ffffff 0%, #fff4df 100%);
}

.tone-2 {
  background: linear-gradient(145deg, #ffffff 0%, #edf3ff 100%);
}

.tone-3 {
  background: linear-gradient(145deg, #ffffff 0%, #f7eee6 100%);
}

.tone-4 {
  background: linear-gradient(145deg, #ffffff 0%, #eef7e6 100%);
}

.delete-btn {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  color: var(--danger-text);
  background: color-mix(in srgb, var(--danger-bg) 80%, #ffffff);
  font-size: 18px;
  line-height: 1;
}

.warehouse-card h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  line-height: 1.2;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quantity-line {
  margin: 0;
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 900;
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 46vh;
  padding: 34px 12px;
  text-align: center;
}

.empty-state.compact {
  min-height: 0;
  padding: 22px 12px;
}

.empty-state strong {
  color: var(--text-strong);
  font-size: 22px;
}

.empty-state span {
  color: var(--text-muted);
  font-size: 13px;
}

.home-page :deep(.van-popup) {
  background: var(--surface);
  color: var(--text-main);
}

.home-page :deep(.edit-popup) {
  width: min(86vw, 360px);
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(38, 56, 88, 0.16);
  overflow: hidden;
}

.simple-editor {
  padding: 18px 18px 14px;
}

.editor-title {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
}

.editor-title strong {
  color: var(--text-strong);
  font-size: 20px;
}

.editor-title span,
.field-row span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.field-row {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.simple-input {
  display: block;
  width: 100%;
  height: 42px;
  border: 0;
  border-bottom: 1px solid var(--divider);
  outline: 0;
  color: var(--text-main);
  background: transparent;
  padding: 0 2px;
  font-size: 15px;
  font-weight: 650;
}

.simple-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.simple-input:focus {
  border-bottom-color: var(--accent);
}

.unit-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.unit-option {
  height: 34px;
  border: 1px solid var(--divider);
  border-radius: 999px;
  color: var(--text-main);
  background: var(--surface-soft);
  font-size: 14px;
  font-weight: 800;
}

.unit-option.active {
  border-color: var(--accent);
  color: #ffffff;
  background: var(--submit-btn-bg);
}

.simple-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
}

.simple-actions button {
  height: 36px;
  border: 0;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
}

.cancel-btn {
  color: var(--text-main);
  background: var(--header-icon-bg);
}

.confirm-btn {
  color: #ffffff;
  background: var(--submit-btn-bg);
  box-shadow: none;
}

.recycle-popup {
  max-height: 78vh;
  overflow-y: auto;
}

.popup-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.recycle-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.recycle-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-soft);
}

.recycle-item strong,
.recycle-item span {
  display: block;
}

.recycle-item strong {
  color: var(--text-strong);
}

.recycle-item span {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recycle-actions {
  display: flex;
  gap: 8px;
}

.recycle-actions button {
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: var(--header-icon-bg);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
}

.recycle-actions button.danger {
  background: var(--danger-bg);
  color: var(--danger-text);
}

@media (max-width: 520px) {
  .home-page {
    padding: 10px;
  }

  .sticky-panel {
    margin: -10px -10px 0;
  }

  .page-header {
    padding: 18px 24px 16px;
  }

  .page-header h1 {
    font-size: 40px;
  }

  .search-section {
    grid-template-columns: minmax(0, 1fr) 86px;
    gap: 8px;
    padding-inline: 10px;
  }

  .create-button {
    min-width: 86px;
    padding: 0 10px;
    font-size: 14px;
  }

  .waterfall-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding-inline: 0;
  }

  .warehouse-card {
    padding: 12px 32px 12px 12px;
    border-radius: 16px;
  }

  .warehouse-card h2 {
    font-size: 16px;
  }

  .quantity-line {
    font-size: 14px;
  }

  .recycle-item {
    grid-template-columns: 1fr;
  }

  .recycle-actions {
    justify-content: flex-end;
  }
}
</style>
