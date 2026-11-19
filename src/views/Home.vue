<template>
  <div class="home-page" :style="themeStyle">
    <div class="sticky-panel">
      <header class="page-header">
        <div class="brand">
          <img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" />
          <div class="brand-text">
            <h1>饮食反应记录</h1>
            <span>共 {{ items.length }} 条记录<template v-if="severeTotal"> · {{ severeTotal }} 条反应明显</template></span>
          </div>
        </div>
        <div class="header-actions">
          <button v-if="showScrollTop" class="header-icon" type="button" aria-label="返回顶部" @click="scrollToTop">
            <el-icon><Top /></el-icon>
          </button>
          <button class="header-icon" type="button" aria-label="设置" @click="settingsPopup = true">
            <el-icon><Setting /></el-icon>
          </button>
        </div>
      </header>

      <section class="search-section" aria-label="搜索和录入">
        <label class="search-box">
          <el-icon><Search /></el-icon>
          <input v-model.trim="keyword" type="search" placeholder="搜索名称或备注" aria-label="搜索名称或备注" />
          <button v-if="keyword" class="search-clear" type="button" aria-label="清空搜索" @click="keyword = ''">
            <el-icon><CircleCloseFilled /></el-icon>
          </button>
        </label>
        <button class="create-button" type="button" @click="openEditor()">
          <el-icon><Plus /></el-icon>
          录入
        </button>
      </section>

      <nav v-if="items.length" class="filter-bar" aria-label="按瘙痒程度筛选">
        <button
          v-for="filter in filterOptions"
          :key="filter.key"
          class="filter-chip"
          :class="{ active: ratingFilter === filter.key }"
          type="button"
          :aria-pressed="ratingFilter === filter.key"
          @click="ratingFilter = filter.key"
        >
          {{ filter.label }}
          <span>{{ filterCounts[filter.key] }}</span>
        </button>
      </nav>
    </div>

    <main class="allergen-view">
      <section v-if="sortedItems.length" class="record-list" aria-label="按星级排序的录入列表">
        <article
          v-for="item in sortedItems"
          :key="item.id"
          class="allergen-card"
          :class="`level-${getLevel(item.rating).key}`"
          tabindex="0"
          @click="openEditor(item)"
          @keydown.enter="openEditor(item)"
        >
          <div class="card-title-row">
            <h2>{{ item.name }}</h2>
            <span
              v-if="item.rating"
              class="card-rating"
              role="img"
              :aria-label="`瘙痒程度：${item.rating} 星`"
            >
              <i v-for="star in 5" :key="star" :class="{ on: star <= item.rating }">★</i>
            </span>
            <span v-else class="card-unrated">未评级</span>
          </div>
          <p v-if="item.note" class="card-note">{{ item.note }}</p>
        </article>
      </section>

      <div v-else class="empty-state">
        <span class="empty-icon">
          <el-icon><component :is="items.length ? Search : EditPen" /></el-icon>
        </span>
        <strong>{{ items.length ? "没有匹配的记录" : "还没有记录" }}</strong>
        <span>{{ items.length ? "换个关键词或筛选条件试试。" : "吃了可疑的食物或佐料后，随手记一笔。" }}</span>
        <button v-if="!items.length" class="create-button" type="button" @click="openEditor()">
          <el-icon><Plus /></el-icon>
          录入第一条
        </button>
        <button v-else class="ghost-button" type="button" @click="resetFilters">清除筛选</button>
      </div>
    </main>

    <van-popup v-model:show="editorPopup" class="edit-popup" round destroy-on-close>
      <form class="simple-editor" @submit.prevent="saveItem">
        <header class="editor-head">
          <div>
            <strong>{{ editingItemId ? "编辑记录" : "新增记录" }}</strong>
            <span>记录可能引起反应的食物或佐料</span>
          </div>
          <button class="editor-close" type="button" aria-label="关闭" @click="editorPopup = false">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <label class="field-row">
          <span>名称</span>
          <input v-model.trim="itemForm.name" class="simple-input" placeholder="例如：花生、酱油" />
        </label>

        <label class="field-row">
          <span>日期</span>
          <input
            v-model="itemForm.recordedAt"
            class="simple-input date-input"
            type="date"
            aria-label="选择录入日期"
          />
        </label>

        <div class="field-row">
          <span>瘙痒程度<em>选填</em></span>
          <div class="rating-field" :class="`level-${getLevel(itemForm.rating).key}`">
            <el-rate v-model="itemForm.rating" clearable aria-label="瘙痒程度（选填），星数越多表示越痒" />
            <span class="level-badge">{{ getLevel(itemForm.rating).label }}</span>
          </div>
        </div>

        <label class="field-row">
          <span>备注<em>选填</em></span>
          <textarea
            v-model.trim="itemForm.note"
            class="simple-input note-input"
            rows="3"
            placeholder="例如：食用约 1 小时后手臂发痒"
          />
        </label>

        <div class="simple-actions" :class="{ 'has-recycle': editingItemId }">
          <button
            v-if="editingItemId"
            class="recycle-btn"
            type="button"
            aria-label="移入回收站"
            title="移入回收站"
            @click="removeItem(editingItemId)"
          >
            <el-icon aria-hidden="true"><Delete /></el-icon>
          </button>
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
              <span>录入于 {{ item.recordedAt }} · {{ getRecycleDaysLeft(item) }} 天后清除</span>
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
      :record-count="items.length"
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
import { CircleCloseFilled, Close, Delete, EditPen, Plus, Search, Setting, Top } from "@element-plus/icons-vue";
import ImportDataPopup from "@/components/ImportDataPopup.vue";
import SettingsPopup from "@/components/SettingsPopup.vue";
import { DEFAULT_THEME, isThemeKey, themeOptions } from "@/config/themes";
import { storageKeys } from "@/utils/toolStorage";
import { LStorage, reportSaveError } from "@/utils/localStorage.ts";
import type { ThemeKey } from "@/config/themes";
import type { DeletedAllergenItem, AllergenBackupData, AllergenItem } from "@/types/tool";
import logoUrl from "@/assets/allergen-icon.svg";

const SCROLL_TOP_THRESHOLD = 240;
const DATE_FORMAT = "YYYY-MM-DD";
const RECYCLE_KEEP_DAYS = 7;
const RECYCLE_KEEP_MS = RECYCLE_KEEP_DAYS * 24 * 60 * 60 * 1000;

type LevelKey = "none" | "mild" | "moderate" | "severe";
type FilterKey = "all" | Exclude<LevelKey, "none">;

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "severe", label: "明显" },
  { key: "moderate", label: "中等" },
  { key: "mild", label: "轻微" },
];

const showScrollTop = ref(false);
const currentTheme = ref<ThemeKey>(DEFAULT_THEME);
const items = ref<AllergenItem[]>([]);
const deletedItems = ref<DeletedAllergenItem[]>([]);
const keyword = ref("");
const ratingFilter = ref<FilterKey>("all");
const settingsPopup = ref(false);
const recyclePopup = ref(false);
const editorPopup = ref(false);
const editingItemId = ref("");
const itemForm = reactive({ name: "", recordedAt: formatDate(new Date()), note: "", rating: 0 });
const importExportInfo = ref({ show: false });
const importInfo = ref({ dataStr: "", fileName: "" });

const itemStorage = LStorage.new(storageKeys.items);
const recycleStorage = LStorage.new(storageKeys.recycleBin);
const themeStorage = LStorage.new(storageKeys.theme);

const currentThemeOption = computed(() => {
  return themeOptions.find((theme) => theme.key === currentTheme.value) || themeOptions[0];
});
const themeStyle = computed(() => currentThemeOption.value.variables);
const keywordMatches = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return items.value;
  return items.value.filter((item) =>
    item.name.toLowerCase().includes(query) || item.note.toLowerCase().includes(query),
  );
});
const filterCounts = computed(() => {
  const counts: Record<FilterKey, number> = { all: keywordMatches.value.length, severe: 0, moderate: 0, mild: 0 };
  for (const item of keywordMatches.value) {
    const level = getLevel(item.rating).key;
    if (level !== "none") counts[level] += 1;
  }
  return counts;
});
const severeTotal = computed(() => items.value.filter((item) => getLevel(item.rating).key === "severe").length);
const sortedItems = computed(() => {
  const matches = ratingFilter.value === "all"
    ? [...keywordMatches.value]
    : keywordMatches.value.filter((item) => getLevel(item.rating).key === ratingFilter.value);
  return matches.sort((a, b) => b.rating - a.rating || b.recordedAt.localeCompare(a.recordedAt));
});

watch(items, saveItems, { deep: true });
watch(deletedItems, saveDeletedItems, { deep: true });

function init() {
  const storedTheme = themeStorage.getter();
  currentTheme.value = isThemeKey(storedTheme) ? storedTheme : DEFAULT_THEME;
  items.value = normalizeItems(itemStorage.getter());
  deletedItems.value = purgeExpiredDeletedItems(normalizeDeletedItems(recycleStorage.getter()));
}

function formatDate(date: Date) {
  return dayjs(date).format("YYYY-MM-DD");
}

function createItem(fields: Pick<AllergenItem, "name" | "recordedAt" | "note" | "rating">): AllergenItem {
  return {
    id: createId("item"),
    ...fields,
    suspected: true,
    updatedAt: new Date().toISOString(),
  };
}

function createId(prefix = "id") {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeItems(value: unknown): AllergenItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Partial<AllergenItem> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : createId("item"),
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "未命名物品",
      recordedAt: typeof item.recordedAt === "string" && item.recordedAt ? item.recordedAt : formatDate(new Date()),
      suspected: item.suspected === true,
      note: typeof item.note === "string" ? item.note.trim() : "",
      rating: typeof item.rating === "number" && Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5
        ? item.rating
        : 0,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    }));
}

function normalizeDeletedItems(value: unknown): DeletedAllergenItem[] {
  if (!Array.isArray(value)) return [];
  return normalizeItems(value).map((item, index) => {
    const raw = value[index] as Partial<DeletedAllergenItem>;
    return {
      ...item,
      deletedAt: typeof raw.deletedAt === "string" ? raw.deletedAt : new Date().toISOString(),
    };
  });
}

function getLevel(rating: number): { key: LevelKey; label: string } {
  if (rating >= 4) return { key: "severe", label: "明显" };
  if (rating >= 2) return { key: "moderate", label: "中等" };
  if (rating >= 1) return { key: "mild", label: "轻微" };
  return { key: "none", label: "未评级" };
}

function resetFilters() {
  keyword.value = "";
  ratingFilter.value = "all";
}

function saveItems() {
  if (items.value.length) {
    void itemStorage.setter(items.value).catch(reportSaveError);
  } else {
    void itemStorage.remove().catch(reportSaveError);
  }
}

function saveDeletedItems() {
  if (deletedItems.value.length) {
    void recycleStorage.setter(deletedItems.value).catch(reportSaveError);
  } else {
    void recycleStorage.remove().catch(reportSaveError);
  }
}

function setTheme(theme: ThemeKey) {
  currentTheme.value = theme;
  void themeStorage.setter(theme).catch(reportSaveError);
}

function openEditor(item?: AllergenItem) {
  editingItemId.value = item?.id || "";
  itemForm.name = item?.name || "";
  itemForm.recordedAt = item?.recordedAt || formatDate(new Date());
  itemForm.note = item?.note ?? "";
  itemForm.rating = item?.rating ?? 0;
  editorPopup.value = true;
}

function saveItem() {
  const name = itemForm.name.trim();
  if (!name) {
    showToast("请填写名称");
    return;
  }

  const fields = {
    ...itemForm,
    name,
    recordedAt: itemForm.recordedAt || formatDate(new Date()),
  };

  if (editingItemId.value) {
    items.value = items.value.map((item) => item.id === editingItemId.value ? {
      ...item,
      ...fields,
      updatedAt: new Date().toISOString(),
    } : item);
  } else {
    items.value = [createItem(fields), ...items.value];
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
    if (editingItemId.value === id) editorPopup.value = false;
    showToast("已移入回收站");
  }).catch(() => {});
}

function openRecycleBin() {
  deletedItems.value = purgeExpiredDeletedItems(deletedItems.value);
  settingsPopup.value = false;
  recyclePopup.value = true;
}

function purgeExpiredDeletedItems(list: DeletedAllergenItem[]) {
  const now = Date.now();
  return list.filter((item) => now - new Date(item.deletedAt).getTime() < RECYCLE_KEEP_MS);
}

function getRecycleDaysLeft(item: DeletedAllergenItem) {
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
  downloadLink.download = `allergen-backup-${dayjs(new Date()).format(DATE_FORMAT)}.json`;
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

function mergeImportedItems(importedItems: AllergenItem[]) {
  const itemsByName = new Map<string, AllergenItem>();
  for (const item of [...items.value, ...importedItems]) {
    const previous = itemsByName.get(item.name);
    const date = dayjs(item.recordedAt);
    const previousDate = previous && dayjs(previous.recordedAt);
    if (!previousDate || (date.isValid() && (!previousDate.isValid() || date.isAfter(previousDate, "day")))) {
      itemsByName.set(item.name, item);
    }
  }

  // Renaming a record can leave the same ID under different names in older backups.
  const usedIds = new Set<string>();
  return Array.from(itemsByName.values(), (item) => {
    if (usedIds.has(item.id)) return { ...item, id: createId("item") };
    usedIds.add(item.id);
    return item;
  });
}

function mergeImportedDeletedItems(importedItems: DeletedAllergenItem[]) {
  const itemsById = new Map(deletedItems.value.map((item) => [item.id, item]));
  for (const item of purgeExpiredDeletedItems(importedItems)) {
    const previous = itemsById.get(item.id);
    if (!previous || dayjs(item.deletedAt).isAfter(previous.deletedAt)) {
      itemsById.set(item.id, item);
    }
  }
  return [...itemsById.values()];
}

async function importData() {
  try {
    const parsedData = JSON.parse(importInfo.value.dataStr) as AllergenBackupData;
    if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) {
      throw new Error("Invalid backup data");
    }
    const importedItems = normalizeItems(parsedData.items);
    if (!Array.isArray(parsedData.items) || importedItems.length !== parsedData.items.length) {
      throw new Error("Invalid items");
    }
    const mergedItems = mergeImportedItems(importedItems);
    const mergedDeletedItems = mergeImportedDeletedItems(normalizeDeletedItems(parsedData.deletedItems));
    await Promise.all([
      itemStorage.setter(mergedItems),
      recycleStorage.setter(mergedDeletedItems),
    ]);
    items.value = mergedItems;
    deletedItems.value = mergedDeletedItems;
    importExportInfo.value.show = false;
    importInfo.value.dataStr = "";
    importInfo.value.fileName = "";
    showToast("备份已合并");
  } catch (error) {
    showToast(error instanceof DOMException && error.name === "QuotaExceededError"
      ? "存储空间不足，导入的数据未保存，请保留备份文件"
      : "导入失败，请检查备份文件");
  }
}

function resetAllData() {
  showConfirmDialog({
    title: "提示",
    message: "确认清除所有饮食反应记录吗？",
    width: "250px",
  }).then(async () => {
    try {
      await Promise.all([itemStorage.remove(), recycleStorage.remove()]);
    } catch (error) {
      reportSaveError(error);
      return;
    }
    items.value = [];
    deletedItems.value = [];
    settingsPopup.value = false;
    showToast("数据已重置");
  }).catch(() => {});
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
  --level-none: #8a96a3;
  --level-none-bg: rgba(138, 150, 163, 0.12);
  --level-mild: #b98a12;
  --level-mild-bg: rgba(242, 184, 48, 0.16);
  --level-moderate: #d06a1e;
  --level-moderate-bg: rgba(240, 134, 54, 0.15);
  --level-severe: #cc4b42;
  --level-severe-bg: rgba(222, 86, 74, 0.13);
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 12px;
  background-color: var(--page-bg);
  color: var(--text-main);
  -webkit-tap-highlight-color: transparent;
}

.home-page,
.home-page * {
  box-sizing: border-box;
}

.home-page button {
  font-family: inherit;
  cursor: pointer;
}

.home-page button:focus-visible,
.allergen-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.allergen-view {
  width: min(100%, 780px);
  margin: 0 auto;
}

.sticky-panel {
  --toolbar-inset: max(16px, calc((100% - 780px) / 2 + 4px));
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0 -12px;
  padding-top: env(safe-area-inset-top);
  background-color: var(--page-bg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px var(--toolbar-inset) 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-logo {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  box-shadow: 0 4px 12px rgba(38, 56, 88, 0.1);
}

.brand-text {
  min-width: 0;
}

.brand-text h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.brand-text span {
  display: block;
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(20, 40, 62, 0.06);
  color: var(--accent);
  font-size: 18px;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.header-icon:active {
  transform: scale(0.94);
}

.search-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 0 var(--toolbar-inset) 10px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 44px;
  padding: 0 6px 0 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--text-muted);
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(20, 40, 62, 0.06);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.search-box input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--text-main);
  background: transparent;
  font-size: 16px;
  font-weight: 500;
  -webkit-appearance: none;
  appearance: none;
}

.search-box input::-webkit-search-cancel-button {
  display: none;
}

.search-box input::placeholder {
  color: var(--text-muted);
  opacity: 0.8;
}

.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
}

.create-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 12px;
  color: #ffffff;
  background: var(--submit-btn-bg);
  box-shadow: var(--submit-btn-shadow);
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.create-button:active {
  transform: scale(0.96);
  filter: brightness(0.95);
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 0 var(--toolbar-inset) 10px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-bar::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--divider);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.filter-chip span {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--surface-muted);
  font-size: 11px;
  text-align: center;
}

.filter-chip.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.filter-chip.active span {
  background: rgba(255, 255, 255, 0.22);
}

.record-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  padding: 14px 4px calc(40px + env(safe-area-inset-bottom));
}

.allergen-card {
  --level-color: var(--level-none);
  --level-bg: var(--level-none-bg);
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--divider);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 4px 14px rgba(38, 56, 88, 0.05);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.allergen-card:active {
  transform: scale(0.985);
}

@media (hover: hover) {
  .allergen-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(38, 56, 88, 0.1);
  }
}

.level-mild {
  --level-color: var(--level-mild);
  --level-bg: var(--level-mild-bg);
}

.level-moderate {
  --level-color: var(--level-moderate);
  --level-bg: var(--level-moderate-bg);
}

.level-severe {
  --level-color: var(--level-severe);
  --level-bg: var(--level-severe-bg);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.allergen-card h2 {
  min-width: 0;
  flex: 1;
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.level-badge {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--level-bg);
  color: var(--level-color);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}

.card-rating {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 2px;
  font-size: 15px;
  line-height: 1;
}

.card-rating i {
  font-style: normal;
  color: var(--surface-muted);
}

.card-rating i.on {
  color: var(--level-color);
}

.card-unrated {
  flex: 0 0 auto;
  color: var(--text-subtle);
  font-size: 12px;
}

.card-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.empty-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  min-height: 56vh;
  padding: 34px 12px;
  text-align: center;
}

.empty-state.compact {
  min-height: 0;
  padding: 22px 12px;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  border-radius: 20px;
  background: var(--header-icon-bg);
  color: var(--accent);
  font-size: 28px;
}

.empty-state strong {
  color: var(--text-strong);
  font-size: 18px;
}

.empty-state.compact strong {
  font-size: 16px;
}

.empty-state span {
  color: var(--text-muted);
  font-size: 13px;
}

.empty-state .create-button,
.ghost-button {
  margin-top: 10px;
}

.ghost-button {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
}

.home-page :deep(.van-popup) {
  background: var(--surface);
  color: var(--text-main);
}

.home-page :deep(.edit-popup) {
  width: min(90vw, 380px);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 18px 48px rgba(38, 56, 88, 0.18);
  max-height: 90vh;
  overflow-y: auto;
}

.simple-editor {
  padding: 18px 18px 16px;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.editor-head strong,
.editor-head span {
  display: block;
}

.editor-head strong {
  color: var(--text-strong);
  font-size: 19px;
}

.editor-head span {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
}

.editor-close {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 15px;
}

.field-row {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.field-row > span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.field-row > span em {
  margin-left: 6px;
  color: var(--text-subtle);
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  opacity: 0.8;
}

.simple-input {
  display: block;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  outline: 0;
  color: var(--text-main);
  background: var(--field-bg);
  font-family: inherit;
  font-size: 16px;
  font-weight: 500;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  -webkit-appearance: none;
  appearance: none;
}

.date-input {
  line-height: 42px;
}

.note-input {
  height: auto;
  min-height: 76px;
  padding: 10px 12px;
  line-height: 1.5;
  resize: vertical;
}

.simple-input::placeholder {
  color: var(--text-muted);
  opacity: 0.65;
}

.simple-input:focus {
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.rating-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--field-bg);
}

.rating-field {
  --level-color: var(--level-none);
  --level-bg: var(--level-none-bg);
}

.rating-field :deep(.el-rate) {
  --el-rate-icon-size: 22px;
  --el-rate-icon-margin: 4px;
  height: 32px;
}

.simple-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 20px;
}

.simple-actions.has-recycle {
  grid-template-columns: 44px 1fr;
}

.simple-actions button {
  height: 44px;
  border: 0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
}

.confirm-btn {
  color: #ffffff;
  background: var(--submit-btn-bg);
  box-shadow: var(--submit-btn-shadow);
}

.simple-actions .recycle-btn {
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--danger-text);
  background: var(--danger-bg);
  font-size: 18px;
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
  border: 1px solid var(--divider);
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
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--header-icon-bg);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
}

.recycle-actions button.danger {
  background: var(--danger-bg);
  color: var(--danger-text);
}

@media (max-width: 520px) {
  .home-page {
    padding: 0 10px;
  }

  .sticky-panel {
    --toolbar-inset: 12px;
    margin: 0 -10px;
  }

  .brand-logo {
    width: 36px;
    height: 36px;
  }

  .brand-text h1 {
    font-size: 19px;
  }

  .record-list {
    padding-inline: 0;
  }

  .allergen-card {
    padding: 12px 14px;
  }

  .allergen-card h2 {
    font-size: 16px;
  }

  .recycle-item {
    grid-template-columns: 1fr;
  }

  .recycle-actions {
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-page * {
    transition: none !important;
  }
}
</style>
