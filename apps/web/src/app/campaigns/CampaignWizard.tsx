"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSegments, createCampaign, updateCampaign, aiDraftCampaign, sendCampaign } from "@/lib/api";
import type { SegmentSummary, AiDraftVariant, CampaignChannel } from "@smartcrm/shared";

type Step = 1 | 2 | 3 | 4;

const CHANNELS: { value: CampaignChannel; label: string; icon: string; hint: string }[] = [
  { value: "email", label: "Email", icon: "✉️", hint: "Rich content, subject line, 50–120 words" },
  { value: "sms", label: "SMS", icon: "💬", hint: "160 characters max, instant delivery" },
  { value: "whatsapp", label: "WhatsApp", icon: "📱", hint: "Conversational, emoji-friendly" }
];

export default function CampaignWizard({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — basics
  const [name, setName] = useState("");
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [loadingSegments, setLoadingSegments] = useState(true);

  // Step 3 — message
  const [message, setMessage] = useState("");
  const [aiVariants, setAiVariants] = useState<AiDraftVariant[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

  // Step 4 — send
  const [draftId, setDraftId] = useState<string | null>(campaignId ?? null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    void getSegments().then(res => {
      setSegments(res.data);
      if (res.data.length > 0) setSegmentId(res.data[0]!.id);
    }).catch(() => null).finally(() => setLoadingSegments(false));
  }, []);

  const selectedSegment = segments.find(s => s.id === segmentId);

  async function handleNext() {
    if (step === 1) {
      if (!name.trim() || !segmentId) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (!message.trim()) return;
      // Save as draft
      setSaving(true);
      setSaveError(null);
      try {
        if (draftId) {
          await updateCampaign(draftId, { name, segmentId, channel, messageTemplate: message });
        } else {
          const camp = await createCampaign({ name, segmentId, channel, messageTemplate: message });
          setDraftId(camp.id);
        }
        setStep(4);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleAiDraft() {
    if (!draftId && !name) return;
    setAiLoading(true);
    setAiError(null);
    setAiVariants([]);

    try {
      // Need a campaign ID to call ai-draft. If no draft yet, create one first.
      let id = draftId;
      if (!id) {
        if (!name.trim() || !segmentId) {
          setAiError("Please fill in the campaign name and segment first.");
          return;
        }
        const camp = await createCampaign({ name, segmentId, channel, messageTemplate: message || "Draft" });
        setDraftId(camp.id);
        id = camp.id;
      }

      const result = await aiDraftCampaign(id);
      setAiVariants(result.variants);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI draft failed");
    } finally {
      setAiLoading(false);
    }
  }

  function pickVariant(idx: number) {
    const v = aiVariants[idx];
    if (v) {
      setSelectedVariant(idx);
      setMessage(v.message);
    }
  }

  async function handleSend() {
    if (!draftId) return;
    setSending(true);
    setSaveError(null);
    try {
      await sendCampaign(draftId);
      router.push(`/campaigns/${draftId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const steps = ["Basics", "Channel", "Message", "Review & Send"];

  return (
    <div className="wizard">
      {/* Step indicator */}
      <div className="wizard-steps">
        {steps.map((label, i) => (
          <div key={label} className={`wizard-step ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`}>
            <div className="wizard-step-dot">{step > i + 1 ? "✓" : i + 1}</div>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="wizard-body">

        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div className="wizard-panel">
            <h2>Campaign basics</h2>
            <p className="panel-hint">Name this campaign and pick the audience segment.</p>

            <div className="field">
              <label>Campaign name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Mumbai VIP Re-engagement"
                maxLength={120}
              />
            </div>

            <div className="field">
              <label>Target segment *</label>
              {loadingSegments ? (
                <div className="loading-inline">Loading segments…</div>
              ) : segments.length === 0 ? (
                <div className="empty-inline">No segments yet — <a href="/segments/new">create one first</a></div>
              ) : (
                <select value={segmentId} onChange={e => setSegmentId(e.target.value)}>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.customerCount.toLocaleString()} customers)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedSegment && (
              <div className="segment-preview-box">
                <span className="segment-preview-count">{selectedSegment.customerCount.toLocaleString()}</span>
                <span className="segment-preview-label">customers will receive this campaign</span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Channel ── */}
        {step === 2 && (
          <div className="wizard-panel">
            <h2>Choose channel</h2>
            <p className="panel-hint">Select how you want to reach your audience.</p>

            <div className="channel-grid">
              {CHANNELS.map(ch => (
                <button
                  key={ch.value}
                  className={`channel-card ${channel === ch.value ? "selected" : ""}`}
                  onClick={() => setChannel(ch.value)}
                >
                  <span className="channel-icon">{ch.icon}</span>
                  <strong>{ch.label}</strong>
                  <span className="channel-hint">{ch.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Message ── */}
        {step === 3 && (
          <div className="wizard-panel">
            <h2>Craft your message</h2>
            <p className="panel-hint">
              Write it yourself or let AI draft 2 variants for you to choose from.
              Use <code>{"{{name}}"}</code> and <code>{"{{last_category}}"}</code> as personalization tokens.
            </p>

            {/* AI draft section */}
            <div className="ai-draft-section">
              <div className="ai-draft-header">
                <span className="ai-badge">✨ AI Draft</span>
                <span className="ai-subtext">Powered by Gemini — generates 2 tone variants</span>
              </div>
              <button
                className="btn btn-ai"
                onClick={handleAiDraft}
                disabled={aiLoading}
              >
                {aiLoading ? "Generating…" : "Generate 2 variants with AI"}
              </button>
              {aiError && <div className="error-inline">{aiError}</div>}

              {aiVariants.length > 0 && (
                <div className="ai-variants">
                  {aiVariants.map((v, i) => (
                    <div
                      key={v.tone}
                      className={`ai-variant-card ${selectedVariant === i ? "selected" : ""}`}
                      onClick={() => pickVariant(i)}
                    >
                      <div className="variant-header">
                        <span className={`variant-tone ${v.tone}`}>{v.tone === "friendly" ? "😊" : "🔥"} {v.label}</span>
                        {selectedVariant === i && <span className="variant-selected-badge">✓ Selected</span>}
                      </div>
                      <p className="variant-message">{v.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual editor */}
            <div className="field">
              <label>Message {selectedVariant !== null ? "(editing selected variant)" : "*"}</label>
              <textarea
                value={message}
                onChange={e => { setMessage(e.target.value); setSelectedVariant(null); }}
                placeholder={`Write your ${channel} message here…`}
                rows={channel === "email" ? 8 : 4}
                maxLength={2000}
              />
              <div className="char-count">{message.length} / 2000</div>
            </div>

            {saveError && <div className="error-inline">{saveError}</div>}
          </div>
        )}

        {/* ── Step 4: Review & Send ── */}
        {step === 4 && (
          <div className="wizard-panel">
            <h2>Review & Send</h2>
            <p className="panel-hint">Double-check everything before sending to your audience.</p>

            <div className="review-grid">
              <div className="review-row">
                <span className="review-label">Campaign name</span>
                <span className="review-value">{name}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Segment</span>
                <span className="review-value">
                  {selectedSegment?.name} —{" "}
                  <strong>{selectedSegment?.customerCount.toLocaleString()} customers</strong>
                </span>
              </div>
              <div className="review-row">
                <span className="review-label">Channel</span>
                <span className="review-value">{channel.toUpperCase()}</span>
              </div>
              <div className="review-row full">
                <span className="review-label">Message preview</span>
                <div className="review-message-preview">{message}</div>
              </div>
            </div>

            {saveError && <div className="error-banner">{saveError}</div>}

            <div className="send-actions">
              <button
                className="btn btn-send"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? "Sending…" : `🚀 Send to ${selectedSegment?.customerCount.toLocaleString() ?? "?"} customers`}
              </button>
              <p className="send-note">
                The channel service will simulate delivery in real-time.
                You can track open/click rates on the campaign detail page.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="wizard-nav">
        {step > 1 && step < 4 && (
          <button className="btn btn-ghost" onClick={() => setStep((step - 1) as Step)}>
            ← Back
          </button>
        )}
        {step < 3 && (
          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={step === 1 && (!name.trim() || !segmentId)}
          >
            Next →
          </button>
        )}
        {step === 3 && (
          <button className="btn btn-primary" onClick={handleNext} disabled={!message.trim() || saving}>
            {saving ? "Saving…" : "Review →"}
          </button>
        )}
      </div>
    </div>
  );
}
