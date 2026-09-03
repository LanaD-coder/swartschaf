import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import HelpButton from "@/components/HelpButton";
import { generateAndSharePurchaseList } from "@/utils/pdf";
import {
  InventoryItem,
  InventoryUnit,
  Service,
  ServiceRecipe,
  Product,
} from "@/lib/types";

type Tab = "consumable" | "recipes" | "retail" | "fernando";
const UNITS: InventoryUnit[] = ["ml", "g", "piece"];
const UNIT_LABELS: Record<InventoryUnit, string> = { ml: "ml", g: "g", piece: "Stück" };
const TABS: { key: Tab; label: string }[] = [
  { key: "consumable", label: "Verbrauchsmaterial" },
  { key: "recipes", label: "Produktverbrauch" },
  { key: "retail", label: "Verkaufsprodukte" },
  { key: "fernando", label: "Fernando" },
];

export default function InventoryScreen() {
  const { profile, salon } = useAuthStore();
  const [exportingList, setExportingList] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { suggested_gebinde: number | null; reasoning_de: string }>>({});
  const [aiPowered, setAiPowered] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("consumable");
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [recipes, setRecipes] = useState<ServiceRecipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // consumable item modal
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemBrand, setItemBrand] = useState("");
  const [itemUnit, setItemUnit] = useState<InventoryUnit>("ml");
  const [itemTotalQty, setItemTotalQty] = useState("");
  const [itemPortionsPerUnit, setItemPortionsPerUnit] = useState("");
  const [itemPurchasePrice, setItemPurchasePrice] = useState("");
  const [itemPortionPrice, setItemPortionPrice] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [itemThreshold, setItemThreshold] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  // recipe modal
  const [recipeModal, setRecipeModal] = useState(false);
  const [recipeServiceId, setRecipeServiceId] = useState<string | null>(null);
  const [recipeItemId, setRecipeItemId] = useState<string | null>(null);
  const [recipePortions, setRecipePortions] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);

  // product modal
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [itemsRes, svcRes, recipesRes, productsRes] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("salon_id", profile?.salon_id).order("name"),
      supabase
        .from("services")
        .select("*")
        .eq("salon_id", profile?.salon_id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("service_recipes")
        .select("*, inventory_item:inventory_items(*)")
        .eq("salon_id", profile?.salon_id),
      supabase.from("products").select("*").eq("salon_id", profile?.salon_id).order("name"),
    ]);
    setItems((itemsRes.data as InventoryItem[]) ?? []);
    setServices((svcRes.data as Service[]) ?? []);
    setRecipes((recipesRes.data as ServiceRecipe[]) ?? []);
    setProducts((productsRes.data as Product[]) ?? []);
    setLoading(false);
  }

  // ── consumable items ─────────────────────────────────────────
  function openItemModal(item?: InventoryItem) {
    setEditingItem(item ?? null);
    setItemCode(item?.product_code ?? "");
    setItemName(item?.name ?? "");
    setItemBrand(item?.brand ?? "");
    setItemUnit(item?.unit ?? "ml");
    setItemTotalQty(item?.total_qty != null ? String(item.total_qty) : "");
    setItemPortionsPerUnit(item?.portions_per_unit != null ? String(item.portions_per_unit) : "");
    setItemPurchasePrice(item?.purchase_price != null ? String(item.purchase_price) : "");
    setItemPortionPrice(item?.portion_price != null ? String(item.portion_price) : "");
    setItemStock(item ? String(item.stock_quantity) : "");
    setItemThreshold(item?.low_stock_threshold != null ? String(item.low_stock_threshold) : "");
    setItemModal(true);
  }

  // Quick action for restocking: adds one gebinde's worth of portions to the
  // stock field (doesn't save by itself — still needs "Speichern").
  function addOneGebinde() {
    const perUnit = Number(itemPortionsPerUnit);
    if (!perUnit) return;
    const current = Number(itemStock) || 0;
    setItemStock(String(current + perUnit));
  }

  async function saveItem() {
    if (!itemName.trim() || !itemStock) return;
    setSavingItem(true);
    const payload = {
      salon_id: profile?.salon_id,
      product_code: itemCode.trim() || null,
      name: itemName.trim(),
      brand: itemBrand.trim() || null,
      unit: itemUnit,
      total_qty: itemTotalQty ? Number(itemTotalQty) : null,
      portions_per_unit: itemPortionsPerUnit ? Number(itemPortionsPerUnit) : null,
      purchase_price: itemPurchasePrice ? Number(itemPurchasePrice) : null,
      portion_price: itemPortionPrice ? Number(itemPortionPrice) : null,
      stock_quantity: Number(itemStock),
      low_stock_threshold: itemThreshold ? Number(itemThreshold) : null,
    };
    if (editingItem) {
      await supabase.from("inventory_items").update(payload).eq("id", editingItem.id);
    } else {
      await supabase.from("inventory_items").insert(payload);
    }
    setSavingItem(false);
    setItemModal(false);
    load();
  }

  function deleteItem(item: InventoryItem) {
    Alert.alert("Löschen?", `"${item.name}" wirklich löschen?`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          await supabase.from("inventory_items").delete().eq("id", item.id);
          load();
        },
      },
    ]);
  }

  // ── recipes ───────────────────────────────────────────────────
  function openRecipeModal() {
    setRecipeServiceId(services[0]?.id ?? null);
    setRecipeItemId(items[0]?.id ?? null);
    setRecipePortions("");
    setRecipeModal(true);
  }

  async function saveRecipe() {
    if (!recipeServiceId || !recipeItemId || !recipePortions) return;
    setSavingRecipe(true);
    await supabase.from("service_recipes").upsert(
      {
        salon_id: profile?.salon_id,
        service_id: recipeServiceId,
        inventory_item_id: recipeItemId,
        portions_per_use: Number(recipePortions),
      },
      { onConflict: "service_id,inventory_item_id" }
    );
    setSavingRecipe(false);
    setRecipeModal(false);
    load();
  }

  async function deleteRecipe(recipe: ServiceRecipe) {
    await supabase.from("service_recipes").delete().eq("id", recipe.id);
    load();
  }

  function serviceName(id: string) {
    return services.find((s) => s.id === id)?.name ?? "–";
  }

  // ── retail products ──────────────────────────────────────────
  function openProductModal(product?: Product) {
    setEditingProduct(product ?? null);
    setProductName(product?.name ?? "");
    setProductPrice(product ? String(product.price) : "");
    setProductStock(product ? String(product.stock_quantity) : "");
    setProductCategory(product?.category ?? "");
    setProductModal(true);
  }

  async function saveProduct() {
    if (!productName.trim() || !productPrice) return;
    setSavingProduct(true);
    const payload = {
      salon_id: profile?.salon_id,
      name: productName.trim(),
      price: Number(productPrice),
      stock_quantity: productStock ? Number(productStock) : 0,
      category: productCategory.trim() || null,
    };
    if (editingProduct) {
      await supabase.from("products").update(payload).eq("id", editingProduct.id);
    } else {
      await supabase.from("products").insert(payload);
    }
    setSavingProduct(false);
    setProductModal(false);
    load();
  }

  function deleteProduct(product: Product) {
    Alert.alert("Löschen?", `"${product.name}" wirklich löschen?`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          await supabase.from("products").delete().eq("id", product.id);
          load();
        },
      },
    ]);
  }

  // ── Fernando (purchase list) ────────────────────────────────
  const lowStockItems = items.filter(
    (i) => i.low_stock_threshold != null && i.stock_quantity <= i.low_stock_threshold
  );

  async function exportPurchaseList() {
    if (!salon) return;
    setExportingList(true);
    try {
      await generateAndSharePurchaseList(items, salon);
    } finally {
      setExportingList(false);
    }
  }

  async function askFernando() {
    if (!profile) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-inventory-forecast", {
        body: { salon_id: profile.salon_id },
      });
      if (error) {
        setAiError(error.message ?? "Fernando konnte nicht erreicht werden.");
        return;
      }
      const map: typeof aiSuggestions = {};
      for (const s of data?.suggestions ?? []) {
        map[s.item_id] = { suggested_gebinde: s.suggested_gebinde, reasoning_de: s.reasoning_de };
      }
      setAiSuggestions(map);
      setAiPowered(data?.ai_powered ?? false);
    } catch (e: any) {
      setAiError(e?.message ?? "Ein unbekannter Fehler ist aufgetreten.");
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Inventar</Text>
          <HelpButton pageKey="inventory" />
        </View>

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "consumable" && (
          <>
            <TouchableOpacity style={styles.addBtn} onPress={() => openItemModal()}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Material hinzufügen</Text>
            </TouchableOpacity>
            {items.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="flask-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>Noch kein Verbrauchsmaterial angelegt</Text>
              </View>
            )}
            {items.map((item) => {
              const low =
                item.low_stock_threshold != null && item.stock_quantity <= item.low_stock_threshold;
              return (
                <TouchableOpacity key={item.id} style={styles.card} onPress={() => openItemModal(item)}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>
                      {item.name}
                      {item.brand ? ` (${item.brand})` : ""}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {item.stock_quantity} Portionen auf Lager
                      {item.low_stock_threshold != null ? ` · Mindestmenge ${item.low_stock_threshold}` : ""}
                      {item.portion_price != null ? ` · €${item.portion_price.toFixed(2)}/Portion` : ""}
                    </Text>
                    {item.product_code && <Text style={styles.cardMeta}>Art.-Nr. {item.product_code}</Text>}
                  </View>
                  {low && <Ionicons name="alert-circle" size={20} color={colors.danger} />}
                  <TouchableOpacity
                    onPress={() => deleteItem(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {tab === "recipes" && (
          <>
            <TouchableOpacity
              style={[styles.addBtn, (!services.length || !items.length) && { opacity: 0.5 }]}
              onPress={openRecipeModal}
              disabled={!services.length || !items.length}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Produktverbrauch hinzufügen</Text>
            </TouchableOpacity>
            {(!services.length || !items.length) && (
              <Text style={styles.hint}>
                Legen Sie zuerst mindestens eine Leistung (Leistungen-Bereich) und ein Verbrauchsmaterial
                an, um den Produktverbrauch zu hinterlegen.
              </Text>
            )}
            {recipes.length === 0 && services.length > 0 && items.length > 0 && (
              <View style={styles.empty}>
                <Ionicons name="beaker-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>Noch kein Produktverbrauch hinterlegt</Text>
              </View>
            )}
            {recipes.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{serviceName(r.service_id)}</Text>
                  <Text style={styles.cardSubtitle}>
                    verbraucht {r.portions_per_use} {r.portions_per_use === 1 ? "Portion" : "Portionen"}{" "}
                    {r.inventory_item?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteRecipe(r)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {tab === "retail" && (
          <>
            <TouchableOpacity style={styles.addBtn} onPress={() => openProductModal()}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Produkt hinzufügen</Text>
            </TouchableOpacity>
            {products.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="pricetag-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>Noch keine Verkaufsprodukte angelegt</Text>
              </View>
            )}
            {products.map((p) => (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => openProductModal(p)}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{p.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    €{p.price.toFixed(2)} · {p.stock_quantity} auf Lager
                    {p.category ? ` · ${p.category}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteProduct(p)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === "fernando" && (
          <>
            <Text style={styles.fernandoIntro}>
              Fernando prüft Ihre Mindestmengen und stellt eine Bestellliste zusammen.
              {aiPowered === true && " Vorschläge unten sind KI-gestützt (Groq), basierend auf dem Verbrauch der letzten 30 Tage."}
              {aiPowered === false && " Kein KI-Vorschlag verfügbar — regelbasierter Vorschlag wird verwendet."}
              {aiPowered === null && " Tippen Sie auf \"Fernando fragen\" für einen KI-gestützten Mengenvorschlag."}
            </Text>
            {aiError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{aiError}</Text>
              </View>
            )}
            {lowStockItems.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
                <Text style={styles.emptyText}>Alles auf Lager — nichts zu bestellen</Text>
              </View>
            ) : (
              <>
                {lowStockItems.map((item) => {
                  const suggestion = aiSuggestions[item.id];
                  return (
                    <View key={item.id} style={styles.card}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>
                          {item.name}
                          {item.brand ? ` (${item.brand})` : ""}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          {item.stock_quantity} von {item.low_stock_threshold} Portionen
                        </Text>
                        {suggestion ? (
                          <Text style={styles.fernandoSuggestion}>
                            {suggestion.suggested_gebinde
                              ? `Vorschlag: ${suggestion.suggested_gebinde} Gebinde — `
                              : ""}
                            {suggestion.reasoning_de}
                          </Text>
                        ) : item.portions_per_unit ? (
                          <Text style={styles.cardMeta}>Vorschlag: 1 Gebinde nachbestellen</Text>
                        ) : null}
                      </View>
                      <Ionicons name="alert-circle" size={20} color={colors.danger} />
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={[styles.addBtn, aiLoading && { opacity: 0.6 }]}
                  onPress={askFernando}
                  disabled={aiLoading}
                >
                  <Ionicons name="sparkles-outline" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>
                    {aiLoading ? "Fernando denkt nach..." : "Fernando fragen"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addBtn, styles.secondaryBtn, exportingList && { opacity: 0.6 }]}
                  onPress={exportPurchaseList}
                  disabled={exportingList}
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.text} />
                  <Text style={[styles.addBtnText, { color: colors.text }]}>
                    {exportingList ? "Erstelle..." : "Bestellliste exportieren"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Consumable item modal */}
      <Modal visible={itemModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingItem ? "Material bearbeiten" : "Material hinzufügen"}
              </Text>

              <Text style={styles.fieldLabel}>Artikelnummer (optional)</Text>
              <TextInput
                style={styles.input}
                value={itemCode}
                onChangeText={setItemCode}
                placeholder="z.B. Herstellercode"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholder="z.B. Blondierpulver"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Marke (optional)</Text>
              <TextInput
                style={styles.input}
                value={itemBrand}
                onChangeText={setItemBrand}
                placeholder="z.B. Wella"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.sectionLabel}>Ein Gebinde</Text>
              <Text style={styles.fieldLabel}>Einheit</Text>
              <View style={styles.chipRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, itemUnit === u && styles.chipActive]}
                    onPress={() => setItemUnit(u)}
                  >
                    <Text style={[styles.chipText, itemUnit === u && styles.chipTextActive]}>
                      {UNIT_LABELS[u]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Gesamtmenge pro Gebinde (optional)</Text>
              <TextInput
                style={styles.input}
                value={itemTotalQty}
                onChangeText={setItemTotalQty}
                keyboardType="numeric"
                placeholder="z.B. 500"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Portionen pro Gebinde (optional)</Text>
              <TextInput
                style={styles.input}
                value={itemPortionsPerUnit}
                onChangeText={setItemPortionsPerUnit}
                keyboardType="numeric"
                placeholder="z.B. 10"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Einkaufspreis pro Gebinde (optional, €)</Text>
              <TextInput
                style={styles.input}
                value={itemPurchasePrice}
                onChangeText={setItemPurchasePrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Preis pro Portion für den Kunden (optional, €)</Text>
              <TextInput
                style={styles.input}
                value={itemPortionPrice}
                onChangeText={setItemPortionPrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.sectionLabel}>Aktueller Lagerbestand</Text>
              <Text style={styles.fieldLabel}>Bestand (in Portionen)</Text>
              <View style={styles.stockRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={itemStock}
                  onChangeText={setItemStock}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
                {!!itemPortionsPerUnit && (
                  <TouchableOpacity style={styles.gebindeBtn} onPress={addOneGebinde}>
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.gebindeBtnText}>1 Gebinde</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.fieldLabel}>Mindestmenge in Portionen (optional)</Text>
              <TextInput
                style={styles.input}
                value={itemThreshold}
                onChangeText={setItemThreshold}
                keyboardType="numeric"
                placeholder="Warnung ab..."
                placeholderTextColor={colors.textMuted}
              />

              <TouchableOpacity
                style={[styles.saveBtn, savingItem && { opacity: 0.6 }]}
                onPress={saveItem}
                disabled={savingItem}
              >
                <Text style={styles.saveBtnText}>{savingItem ? "Speichern..." : "Speichern"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setItemModal(false)}>
                <Text style={styles.cancelText}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Recipe modal */}
      <Modal visible={recipeModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>Produktverbrauch hinzufügen</Text>
            <Text style={styles.fieldLabel}>Leistung</Text>
            <View style={styles.chipRow}>
              {services.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, recipeServiceId === s.id && styles.chipActive]}
                  onPress={() => setRecipeServiceId(s.id)}
                >
                  <Text style={[styles.chipText, recipeServiceId === s.id && styles.chipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Verbrauchsmaterial</Text>
            <View style={styles.chipRow}>
              {items.map((i) => (
                <TouchableOpacity
                  key={i.id}
                  style={[styles.chip, recipeItemId === i.id && styles.chipActive]}
                  onPress={() => setRecipeItemId(i.id)}
                >
                  <Text style={[styles.chipText, recipeItemId === i.id && styles.chipTextActive]}>
                    {i.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Portionen pro Anwendung</Text>
            <TextInput
              style={styles.input}
              value={recipePortions}
              onChangeText={setRecipePortions}
              keyboardType="numeric"
              placeholder="z.B. 1"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[styles.saveBtn, savingRecipe && { opacity: 0.6 }]}
              onPress={saveRecipe}
              disabled={savingRecipe}
            >
              <Text style={styles.saveBtnText}>{savingRecipe ? "Speichern..." : "Speichern"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRecipeModal(false)}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Product modal */}
      <Modal visible={productModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>
              {editingProduct ? "Produkt bearbeiten" : "Produkt hinzufügen"}
            </Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="z.B. Pflegeshampoo"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Preis (€)</Text>
            <TextInput
              style={styles.input}
              value={productPrice}
              onChangeText={setProductPrice}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Bestand</Text>
            <TextInput
              style={styles.input}
              value={productStock}
              onChangeText={setProductStock}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Kategorie (optional)</Text>
            <TextInput
              style={styles.input}
              value={productCategory}
              onChangeText={setProductCategory}
              placeholder="z.B. Pflege"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[styles.saveBtn, savingProduct && { opacity: 0.6 }]}
              onPress={saveProduct}
              disabled={savingProduct}
            >
              <Text style={styles.saveBtnText}>{savingProduct ? "Speichern..." : "Speichern"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setProductModal(false)}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  content: { padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: "700", color: colors.text },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  tabBtnTextActive: { color: "#fff" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  errorBox: {
    backgroundColor: "#3d0000",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  errorText: { color: "#ff6666", fontSize: 13 },
  fernandoSuggestion: { fontSize: 12, color: colors.timerActive, marginTop: 4, lineHeight: 16 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  fernandoIntro: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: 12,
    marginBottom: 2,
  },
  stockRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  gebindeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  gebindeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { alignItems: "center", gap: 12, marginTop: 40, marginBottom: 20 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
    maxHeight: "85%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
  fieldLabel: { fontSize: 13, color: colors.textMuted },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelText: { color: colors.textMuted, textAlign: "center", padding: 12 },
});
