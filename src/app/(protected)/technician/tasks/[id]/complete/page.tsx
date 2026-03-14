"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, Loader2, X, Lock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MIN_NOTES_LENGTH = 20;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function getErrorMessage(res: Response, fallback: string) {
    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
        try {
            const data = await res.json() as { message?: string };
            if (typeof data.message === "string" && data.message.trim()) return data.message;
        } catch {
            // Fall through to default message.
        }
    } else {
        try {
            const text = (await res.text()).trim();
            if (text) return text;
        } catch {
            // Fall through to default message.
        }
    }

    return `${fallback} (HTTP ${res.status})`;
}

export default function CompleteTicketPage() {
    const { id } = useParams();
    const router = useRouter();
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [notes, setNotes] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    const notesOk = notes.trim().length >= MIN_NOTES_LENGTH;
    const photoOk = !!uploadedUrl;
    const canSubmit = notesOk && photoOk && !submitting;

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error("Use JPEG, PNG, or WebP image format");
            e.target.value = "";
            return;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            toast.error("Photo is too large. Maximum allowed size is 5MB.");
            e.target.value = "";
            return;
        }

        setImagePreview(URL.createObjectURL(file));

        // Auto-upload
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            
            const res = await fetch("/api/uploads", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const message = await getErrorMessage(res, "Upload failed");
                throw new Error(message);
            }
            
            const data = await res.json();
            setUploadedUrl(data.url);
            toast.success("Photo uploaded");
        } catch (e: any) {
            toast.error(e.message || "Upload failed — try again");
            setImagePreview(null);
            setUploadedUrl(null);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    async function handleSubmit() {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/tickets/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "COMPLETE",
                    resolutionNotes: notes,
                    imageUrls: uploadedUrl ? [uploadedUrl] : [],
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message);
            }
            toast.success("Ticket completed!", { description: "Manager has been notified for verification." });
            router.push("/technician/dashboard");
        } catch (e: any) {
            toast.error(e.message || "Failed to complete ticket");
        } finally {
            setSubmitting(false);
        }
    }

    const notesProgress = Math.min(100, (notes.trim().length / MIN_NOTES_LENGTH) * 100);
    const overallProgress = (notesOk ? 50 : notesProgress / 2) + (photoOk ? 50 : 0);

    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-50 bg-pt-surface/90 backdrop-blur-md border-b border-pt-border px-4 h-14 flex items-center gap-3">
                <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-pt-text-dim hover:text-pt-text">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-pt-text">Mark as Complete</span>
            </header>

            <div className="flex flex-col gap-5 p-4 pb-80">

                {/* Progress Indicator */}
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">Completion Progress</p>
                        <p className="text-sm font-bold text-pt-text">{Math.round(overallProgress)}%</p>
                    </div>
                    <div className="h-2 bg-pt-surface-light rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-pt-accent to-pt-green rounded-full"
                            animate={{ width: `${overallProgress}%` }}
                            transition={{ type: "spring", stiffness: 100 }}
                        />
                    </div>
                    <div className="flex gap-4 mt-3">
                        <div className={cn("flex items-center gap-1.5 text-xs", notesOk ? "text-pt-green" : "text-pt-text-muted")}>
                            <div className={cn("w-4 h-4 rounded-full flex items-center justify-center", notesOk ? "bg-pt-green/20" : "bg-pt-surface-light")}>
                                {notesOk ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-pt-text-muted" />}
                            </div>
                            Resolution Notes
                        </div>
                        <div className={cn("flex items-center gap-1.5 text-xs", photoOk ? "text-pt-green" : "text-pt-text-muted")}>
                            <div className={cn("w-4 h-4 rounded-full flex items-center justify-center", photoOk ? "bg-pt-green/20" : "bg-pt-surface-light")}>
                                {photoOk ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-pt-text-muted" />}
                            </div>
                            Proof Photo
                        </div>
                    </div>
                </div>

                {/* Resolution Notes */}
                <section className="bg-pt-surface border border-pt-border rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <Label className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">
                            Resolution Notes
                        </Label>
                        <span className={cn("text-xs font-mono", notesOk ? "text-pt-green" : "text-pt-text-muted")}>
                            {notes.trim().length}/{MIN_NOTES_LENGTH}+
                        </span>
                    </div>
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Describe what was done to fix the issue, parts replaced, observations..."
                        rows={5}
                        className="bg-pt-surface-light border-pt-border/60 rounded-xl resize-none text-sm"
                    />
                    {/* Inline character progress */}
                    <div className="mt-2 h-1 bg-pt-surface-light rounded-full overflow-hidden">
                        <motion.div
                            className={cn("h-full rounded-full", notesOk ? "bg-pt-green" : "bg-pt-accent")}
                            animate={{ width: `${notesProgress}%` }}
                            transition={{ type: "spring", stiffness: 200 }}
                        />
                    </div>
                </section>

                {/* Photo Upload */}
                <section className="bg-pt-surface border border-pt-border rounded-2xl p-4">
                    <Label className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider block mb-3">
                        Proof of Completion Photo
                    </Label>

                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    <AnimatePresence mode="wait">
                        {imagePreview ? (
                            <motion.div
                                key="preview"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative"
                            >
                                <img
                                    src={imagePreview}
                                    alt="Completion proof"
                                    className="w-full aspect-video object-cover rounded-xl border border-pt-border"
                                />
                                {uploading && (
                                    <div className="absolute inset-0 bg-pt-bg/70 rounded-xl flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-6 h-6 text-pt-accent animate-spin" />
                                            <p className="text-xs text-pt-text">Uploading...</p>
                                        </div>
                                    </div>
                                )}
                                {photoOk && (
                                    <div className="absolute top-2 right-2 bg-pt-green rounded-full p-1">
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <button
                                    onClick={() => { setImagePreview(null); setUploadedUrl(null); }}
                                    className="mt-2 text-xs text-pt-text-muted hover:text-pt-red flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Remove photo
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="w-full border-2 border-dashed border-pt-border/60 rounded-xl p-4 flex flex-col items-center justify-center gap-3"
                            >
                                <div className="w-12 h-12 bg-pt-accent/10 rounded-full flex items-center justify-center group-hover:bg-pt-accent/20 transition-colors">
                                    <Camera className="w-6 h-6 text-pt-accent" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-pt-text">Add proof photo</p>
                                    <p className="text-xs text-pt-text-muted mt-0.5">Required proof of completion</p>
                                </div>
                                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="h-11 rounded-xl bg-pt-accent text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-pt-accent/90 transition-colors"
                                    >
                                        <Camera className="w-4 h-4" />
                                        Take Photo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="h-11 rounded-xl border border-pt-border bg-pt-surface-light text-pt-text text-sm font-semibold flex items-center justify-center gap-2 hover:border-pt-accent/50 transition-colors"
                                    >
                                        <ImagePlus className="w-4 h-4" />
                                        Choose from Gallery
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>

            {/* Submit Bar */}
            <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] bg-pt-surface/95 backdrop-blur-md border-t border-pt-border p-4 z-40">
                {!canSubmit && (
                    <div className="flex items-center gap-2 mb-3 justify-center">
                        <Lock className="w-3.5 h-3.5 text-pt-text-muted" />
                        <p className="text-xs text-pt-text-muted">
                            {!notesOk && !photoOk ? "Add notes and a proof photo to unlock" :
                             !notesOk ? "Add resolution notes (20+ chars)" :
                             "Upload a proof photo"}
                        </p>
                    </div>
                )}
                <motion.button
                    whileTap={canSubmit ? { scale: 0.97 } : {}}
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={cn(
                        "w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all",
                        canSubmit
                            ? "bg-pt-green hover:bg-pt-green/90 text-white shadow-lg shadow-pt-green/30 animate-[pulse_3s_ease-in-out_infinite]"
                            : "bg-pt-surface-light text-pt-text-muted border border-pt-border cursor-not-allowed"
                    )}
                >
                    {submitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <CheckCircle2 className="w-5 h-5" />
                            Submit Completion
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
}
