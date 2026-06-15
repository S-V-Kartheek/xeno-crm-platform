"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SegmentCondition, SegmentRules } from "@smartcrm/shared";
import {
  ALL_SEGMENT_FIELDS,
  COMPUTED_FIELDS,
  DIRECT_FIELDS
} from "@smartcrm/shared";
import { previewSegment, aiGenerateSegment, createSegment, updateSegment } from "@/lib/api";
import type { SegmentPreview } from "@/lib/api";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  city: "City",
  categoryAffinity: "Category affinity",
  aovTier: "AOV tier",
  orderCount: "Order count",
  totalSpent: "Total spent (₹)",
  daysSinceLastOrder: "Days since last order"
};

const STRING_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "contains", label: "contains" }
];

const ENUM_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "in", label: "is one of" }
];

const NUMBER_OPERATORS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" }
];

const AOV_TIER_VALUES = ["value", "mid", "high"];

function getOperatorsForField(field: string) {
  if (field === "aovTier") return ENUM_OPERATORS;
  if (COMPUTED_FIELDS.includes(field as (typeof COMPUTED_FIELDS)[number])) return NUMBER_OPERATORS;
  return STRING_OPERATORS;
}

function defaultCondition(): SegmentCondition {
  return { field: "city", operator: "contains", value: "" };
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Props = {
  mode: "create" | "edit";
  segmentId?: string;
  initialName?: string;
  initialDescription?: string;
  initialRules?: SegmentRules;
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function SegmentBuilder({
  mode,
  segmentId,
  initialName = "",
  initialDescription = "",
  initialRules
}: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [logic, setLogic] = useState<"AND" | "OR">(initialRules?.logic ?? "AND");
  const [conditions, setConditions] = useState<SegmentCondition[]>(
    initialRules?.conditions ?? [defaultCondition()]
  );

  // AI section
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Preview section
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save section
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Live preview (debounced 600ms) ──────────────────────────
  const runPreview = useCallback(
    async (conds: SegmentCondition[], lgc: "AND" | "OR") => {
      const validConds = conds.filter((c) => String(c.value).trim() !== "");
      if (validConds.length === 0) {
        setPreview(null);
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await previewSegment({ logic: lgc, conditions: validConds });
        setPreview(result);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
      } finally {
        setPreviewLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      void runPreview(conditions, logic);
    }, 600);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [conditions, logic, runPreview]);

  // ── Condition management ─────────────────────────────────────
  function updateCondition(index: number, patch: Partial<SegmentCondition>) {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, ...patch };
        // Reset operator and value when field changes
        if (patch.field && patch.field !== c.field) {
          const ops = getOperatorsForField(patch.field);
          updated.operator = ops[0]!.value as SegmentCondition["operator"];
          updated.value = "";
        }
        return updated;
      })
    );
  }

  function addCondition() {
    if (conditions.length >= 6) return;
    setConditions((prev) => [...prev, defaultCondition()]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  // ── AI generate ──────────────────────────────────────────────
  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiGenerateSegment(aiPrompt);
      // Populate the builder with AI-generated rules — fully editable
      setLogic(result.rules.logic);
      setConditions(result.rules.conditions);
      setPreview(result.preview);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "AI couldn't process this prompt — try again or build manually."
      );
    } finally {
      setAiLoading(false);
    }
  }

  // ── Save ─────────────────────────────────────────────────────
  async function handleSave() {
    const validConds = conditions.filter((c) => String(c.value).trim() !== "");
    if (!name.trim()) {
      setSaveError("Segment name is required");
      return;
    }
    if (validConds.length === 0) {
      setSaveError("Add at least one complete condition");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const rules: SegmentRules = { logic, conditions: validConds };
      if (mode === "create") {
        await createSegment({ name: name.trim(), description: description.trim() || undefined, rules });
      } else {
        await updateSegment(segmentId!, {
          name: name.trim(),
          description: description.trim() || undefined,
          rules
        });
      }
      router.push("/segments");
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="builder-layout">
      {/* Left: Builder */}
      <div className="builder-main stack">
        {/* AI Input */}
        <div className="card ai-card">
          <div className="ai-header">
            <span className="ai-icon">✦</span>
            <strong>AI Segmentation</strong>
            <span className="badge ai-badge">Powered by Gemini</span>
          </div>
          <p className="muted ai-desc">
            Describe your audience in plain English. AI translates it into editable rules below —
            you stay in control.
          </p>
          <div className="ai-input-row">
            <input
              className="input"
              id="ai-prompt-input"
              placeholder='e.g. "customers who bought ethnic wear but haven&apos;t ordered in 60 days"'
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !aiLoading) void handleAiGenerate();
              }}
            />
            <button
              className="button primary ai-btn"
              id="ai-generate-btn"
              onClick={() => void handleAiGenerate()}
              disabled={aiLoading || !aiPrompt.trim()}
            >
              {aiLoading ? <span className="spinner" /> : "Generate"}
            </button>
          </div>
          {aiError ? (
            <div className="ai-error">
              <strong>AI error:</strong> {aiError}
              <br />
              <span className="muted">You can still build rules manually below.</span>
            </div>
          ) : null}
        </div>

        {/* Rule builder */}
        <div className="card">
          <div className="builder-rule-header">
            <h2>Filter rules</h2>
            <div className="logic-toggle">
              <span className="muted">Match</span>
              <button
                id="logic-toggle-and"
                className={`toggle-btn ${logic === "AND" ? "active" : ""}`}
                onClick={() => setLogic("AND")}
              >
                ALL (AND)
              </button>
              <button
                id="logic-toggle-or"
                className={`toggle-btn ${logic === "OR" ? "active" : ""}`}
                onClick={() => setLogic("OR")}
              >
                ANY (OR)
              </button>
              <span className="muted">conditions</span>
            </div>
          </div>

          <div className="conditions-list">
            {conditions.map((condition, i) => (
              <div key={i} className="condition-row">
                {i > 0 && (
                  <div className="logic-label">{logic === "AND" ? "AND" : "OR"}</div>
                )}
                <select
                  className="select"
                  id={`field-select-${i}`}
                  value={condition.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value as SegmentCondition["field"] })}
                >
                  {ALL_SEGMENT_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f] ?? f}
                    </option>
                  ))}
                </select>

                <select
                  className="select"
                  id={`operator-select-${i}`}
                  value={condition.operator}
                  onChange={(e) => updateCondition(i, { operator: e.target.value as SegmentCondition["operator"] })}
                >
                  {getOperatorsForField(condition.field).map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {condition.field === "aovTier" ? (
                  condition.operator === "in" ? (
                    <div className="multi-select-wrap">
                      {AOV_TIER_VALUES.map((v) => (
                        <label key={v} className="check-label">
                          <input
                            type="checkbox"
                            checked={Array.isArray(condition.value) && condition.value.includes(v)}
                            onChange={(e) => {
                              const current = Array.isArray(condition.value) ? condition.value : [];
                              const next = e.target.checked
                                ? [...current, v]
                                : current.filter((x) => x !== v);
                              updateCondition(i, { value: next });
                            }}
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <select
                      className="select"
                      id={`value-select-${i}`}
                      value={String(condition.value)}
                      onChange={(e) => updateCondition(i, { value: e.target.value })}
                    >
                      <option value="">Select tier</option>
                      {AOV_TIER_VALUES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  )
                ) : COMPUTED_FIELDS.includes(condition.field as (typeof COMPUTED_FIELDS)[number]) ? (
                  <input
                    className="input value-input"
                    id={`value-input-${i}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={String(condition.value)}
                    onChange={(e) => updateCondition(i, { value: Number(e.target.value) })}
                  />
                ) : (
                  <input
                    className="input value-input"
                    id={`value-input-${i}`}
                    type="text"
                    placeholder={condition.field === "city" ? "e.g. Mumbai" : "e.g. ethnic wear"}
                    value={String(condition.value)}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                  />
                )}

                {conditions.length > 1 ? (
                  <button
                    className="remove-btn"
                    id={`remove-condition-${i}`}
                    onClick={() => removeCondition(i)}
                    title="Remove condition"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {conditions.length < 6 ? (
            <button
              className="button add-condition-btn"
              id="add-condition-btn"
              onClick={addCondition}
            >
              + Add condition
            </button>
          ) : (
            <p className="muted" style={{ fontSize: "12px", marginTop: "8px" }}>
              Maximum 6 conditions reached
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="card">
          <h2>Segment details</h2>
          <div className="form-group">
            <label className="label" htmlFor="segment-name">Name *</label>
            <input
              className="input"
              id="segment-name"
              type="text"
              placeholder="e.g. High-value Mumbai buyers"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="segment-description">Description (optional)</label>
            <input
              className="input"
              id="segment-description"
              type="text"
              placeholder="What is this segment for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {saveError ? <div className="form-error">{saveError}</div> : null}
          <div className="builder-actions">
            <button
              className="button"
              id="cancel-segment-btn"
              onClick={() => router.push("/segments")}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="button primary"
              id="save-segment-btn"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving…" : mode === "create" ? "Save segment" : "Update segment"}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Live preview panel */}
      <aside className="preview-panel">
        <div className="card preview-card">
          <h3>Live preview</h3>
          <p className="muted preview-hint">Updates as you build rules.</p>

          {previewLoading ? (
            <div className="preview-loading">
              <span className="spinner" />
              <span className="muted">Counting…</span>
            </div>
          ) : previewError ? (
            <div className="preview-error muted">{previewError}</div>
          ) : preview ? (
            <>
              <div className="preview-count">
                <span className="count-big">{preview.count.toLocaleString("en-IN")}</span>
                <span className="muted"> customers match</span>
              </div>
              {preview.count === 0 ? (
                <p className="muted preview-zero">
                  ⚠️ No customers match these rules — consider relaxing the conditions.
                </p>
              ) : null}
              {preview.sample.length > 0 ? (
                <div className="preview-sample">
                  <div className="preview-sample-label muted">Sample customers</div>
                  {preview.sample.map((c) => (
                    <div key={c.id} className="preview-customer">
                      <span className="preview-name">{c.name}</span>
                      <span className="muted preview-city">{c.city ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted preview-hint">Add a condition to see the matching count.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
