"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings, Bell, Clock, Phone, Loader2, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface BuildingSettings {
    id: string;
    name: string;
    emergencyPhone: string | null;
    businessHoursStart: number;
    businessHoursEnd: number;
    businessDays: number[];
}

interface EscalationRule {
    id?: string;
    ruleName: string;
    triggerHours: number;
    action: string;
    enabled: boolean;
}

export default function ManagerSettingsPage() {
    const [buildingId, setBuildingId] = useState<string | null>(null);
    const [settings, setSettings] = useState<BuildingSettings | null>(null);
    const [rules, setRules] = useState<EscalationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function loadData() {
            // Get manager's building id
            const res = await fetch("/api/buildings?mine=1");
            if (!res.ok) { setLoading(false); return; }
            const buildings: BuildingSettings[] = await res.json();
            if (!buildings.length) { setLoading(false); return; }
            const b = buildings[0];
            setBuildingId(b.id);
            setSettings(b);

            const rulesRes = await fetch(`/api/buildings/${b.id}/escalation-rules`);
            if (rulesRes.ok) setRules(await rulesRes.json());
            setLoading(false);
        }
        loadData();
    }, []);

    async function saveSettings() {
        if (!buildingId || !settings) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/buildings/${buildingId}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    businessHoursStart: settings.businessHoursStart,
                    businessHoursEnd: settings.businessHoursEnd,
                    businessDays: settings.businessDays,
                    emergencyPhone: settings.emergencyPhone,
                }),
            });
            if (!res.ok) throw new Error();

            const rulesRes = await fetch(`/api/buildings/${buildingId}/escalation-rules`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rules.map(({ id, ...r }) => r)),
            });
            if (!rulesRes.ok) throw new Error("Failed to save rules");

            toast.success("Settings saved!");
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    }

    function toggleDay(day: number) {
        if (!settings) return;
        const days = settings.businessDays.includes(day)
            ? settings.businessDays.filter((d) => d !== day)
            : [...settings.businessDays, day].sort();
        setSettings({ ...settings, businessDays: days });
    }

    function addRule() {
        setRules((prev) => [...prev, {
            ruleName: "New Rule",
            triggerHours: 24,
            action: "notify_manager",
            enabled: true,
        }]);
    }

    function removeRule(idx: number) {
        setRules((prev) => prev.filter((_, i) => i !== idx));
    }

    function updateRule<K extends keyof EscalationRule>(idx: number, key: K, value: EscalationRule[K]) {
        setRules((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r));
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-pt-accent animate-spin" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-4 text-center">
                <p className="text-pt-text-muted">No buildings found for your account.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 p-4 pb-36">
            {/* Header */}
            <div className="pt-1">
                <p className="text-pt-text-dim text-sm">Manager</p>
                <h1 className="text-2xl font-bold text-pt-text tracking-tight flex items-center gap-2">
                    <Settings className="w-5 h-5 text-pt-accent" />
                    Building Settings
                </h1>
                <p className="text-xs text-pt-text-muted mt-1">{settings.name}</p>
            </div>

            {/* Emergency Contact */}
            <section className="bg-pt-surface border border-pt-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-pt-red" />
                    <p className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">Emergency Contact</p>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-pt-text-muted">Phone Number</Label>
                    <Input
                        value={settings.emergencyPhone ?? ""}
                        onChange={(e) => setSettings({ ...settings, emergencyPhone: e.target.value || null })}
                        placeholder="+1-800-000-0000"
                        className="bg-pt-surface-light border-pt-border/60 text-pt-text rounded-xl h-10"
                    />
                    <p className="text-[11px] text-pt-text-muted/60">
                        Shown to tenants during after-hours emergencies.
                    </p>
                </div>
            </section>

            {/* Business Hours */}
            <section className="bg-pt-surface border border-pt-border rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-pt-blue" />
                    <p className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">Business Hours</p>
                </div>

                {/* Working days */}
                <div className="space-y-2">
                    <Label className="text-xs text-pt-text-muted">Working Days</Label>
                    <div className="flex gap-2 flex-wrap">
                        {DAYS.map((day, idx) => (
                            <button
                                key={day}
                                onClick={() => toggleDay(idx)}
                                className={cn(
                                    "w-10 h-10 rounded-xl text-xs font-semibold border transition-all",
                                    settings.businessDays.includes(idx)
                                        ? "bg-pt-accent border-pt-accent text-white"
                                        : "bg-pt-surface-light border-pt-border text-pt-text-muted"
                                )}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Hours range */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs text-pt-text-muted">Opens at</Label>
                        <select
                            value={settings.businessHoursStart}
                            onChange={(e) => setSettings({ ...settings, businessHoursStart: Number(e.target.value) })}
                            className="w-full bg-pt-surface-light border border-pt-border/60 text-pt-text rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-pt-accent"
                        >
                            {HOURS.map((h) => (
                                <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-pt-text-muted">Closes at</Label>
                        <select
                            value={settings.businessHoursEnd}
                            onChange={(e) => setSettings({ ...settings, businessHoursEnd: Number(e.target.value) })}
                            className="w-full bg-pt-surface-light border border-pt-border/60 text-pt-text rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-pt-accent"
                        >
                            {HOURS.map((h) => (
                                <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <p className="text-[11px] text-pt-text-muted/60">
                    Tickets submitted outside these hours are flagged as &quot;after-hours&quot;.
                </p>
            </section>

            {/* Escalation Rules */}
            <section className="bg-pt-surface border border-pt-border rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-pt-yellow" />
                    <p className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider flex-1">
                        Escalation Rules
                    </p>
                    <button
                        onClick={addRule}
                        className="w-8 h-8 rounded-lg bg-pt-accent/10 border border-pt-accent/30 flex items-center justify-center text-pt-accent hover:bg-pt-accent/20 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {rules.length === 0 ? (
                    <p className="text-xs text-pt-text-muted text-center py-3">
                        No escalation rules. Add one to auto-notify on stalled tickets.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {rules.map((rule, idx) => (
                            <div key={idx} className="bg-pt-surface-light border border-pt-border/50 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={rule.ruleName}
                                        onChange={(e) => updateRule(idx, "ruleName", e.target.value)}
                                        placeholder="Rule name"
                                        className="flex-1 h-8 text-xs bg-transparent border-pt-border/40 text-pt-text rounded-lg"
                                    />
                                    <button onClick={() => removeRule(idx)} className="text-pt-text-muted hover:text-pt-red">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-pt-text-muted">After</span>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={rule.triggerHours}
                                        onChange={(e) => updateRule(idx, "triggerHours", parseInt(e.target.value) || 1)}
                                        className="w-16 h-7 text-xs bg-transparent border-pt-border/40 text-pt-text rounded-lg text-center"
                                    />
                                    <span className="text-pt-text-muted">hrs → action:</span>
                                    <Input
                                        value={rule.action}
                                        onChange={(e) => updateRule(idx, "action", e.target.value)}
                                        placeholder="notify_manager"
                                        className="flex-1 h-7 text-xs bg-transparent border-pt-border/40 text-pt-text rounded-lg"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => updateRule(idx, "enabled", !rule.enabled)}
                                        className={cn(
                                            "relative w-9 h-5 rounded-full border transition-all",
                                            rule.enabled
                                                ? "bg-pt-green border-pt-green"
                                                : "bg-pt-surface border-pt-border"
                                        )}
                                    >
                                        <span className={cn(
                                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                                            rule.enabled ? "left-4" : "left-0.5"
                                        )} />
                                    </button>
                                    <span className="text-xs text-pt-text-muted">
                                        {rule.enabled ? "Enabled" : "Disabled"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Save button */}
            <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] bg-pt-surface/95 backdrop-blur-md border-t border-pt-border p-4 z-40">
                <Button
                    onClick={saveSettings}
                    disabled={saving}
                    className="w-full h-12 bg-pt-accent hover:bg-pt-accent/90 text-white rounded-2xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-pt-accent/20"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4" />
                    )}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
