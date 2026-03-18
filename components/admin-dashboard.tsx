"use client";

import { useEffect, useMemo, useState } from "react";

import { MarkdownContent } from "@/components/markdown-content";
import { Badge, Button, Input, JoinCodeBadge, Panel, SectionHeading, Select, Textarea } from "@/components/ui";
import type { getAdminEventState } from "@/lib/game/service";

type AdminState = Awaited<ReturnType<typeof getAdminEventState>>;
type TaskType = "competitive" | "cooperative";
type AdminTab = "challenges" | "tasks" | "people" | "standings" | "settings" | "audit";
type ImageState = { imagePath: string; imageUrl: string };
type DraftState = {
  title: string;
  shortDescription: string;
  fullDescription: string;
  type: TaskType;
  isActive: boolean;
  imagePath: string;
  imageUrl: string;
};
type TemplateDraftState = Omit<DraftState, "isActive">;

function createEmptyImageState(): ImageState {
  return { imagePath: "", imageUrl: "" };
}

function createEmptyTaskDraft(): DraftState {
  return {
    title: "",
    shortDescription: "",
    fullDescription: "",
    type: "competitive",
    isActive: true,
    ...createEmptyImageState(),
  };
}

function createEmptyTemplateDraft(): TemplateDraftState {
  return {
    title: "",
    shortDescription: "",
    fullDescription: "",
    type: "competitive",
    ...createEmptyImageState(),
  };
}

function ImagePreview({
  imageUrl,
  alt,
  compact = false,
}: {
  imageUrl?: string | null;
  alt: string;
  compact?: boolean;
}) {
  if (!imageUrl) {
    return (
      <div
        className={
          compact
            ? "flex h-20 items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-white text-xs uppercase tracking-[0.22em] text-ink/35"
            : "flex h-36 items-center justify-center rounded-3xl border border-dashed border-ink/15 bg-white text-xs uppercase tracking-[0.22em] text-ink/35"
        }
      >
        No image yet
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={compact ? "h-20 w-full rounded-2xl object-cover" : "h-36 w-full rounded-3xl object-cover"}
    />
  );
}

export function AdminDashboard({
  slug,
  initialState,
}: {
  slug: string;
  initialState: AdminState;
}) {
  const [state, setState] = useState(initialState);
  const [activeTab, setActiveTab] = useState<AdminTab>("challenges");
  const [eventTitle, setEventTitle] = useState(initialState.event.title);
  const [targetTeamSize, setTargetTeamSize] = useState(String(initialState.event.targetTeamSize));
  const [taskDraft, setTaskDraft] = useState<DraftState>(createEmptyTaskDraft());
  const [templateDraft, setTemplateDraft] = useState<TemplateDraftState>(createEmptyTemplateDraft());
  const [taskImageDrafts, setTaskImageDrafts] = useState<Record<string, ImageState>>({});
  const [templateQuery, setTemplateQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const activeTaskCount = state.tasks.filter((task) => task.isActive).length;
  const canManageRegistrations =
    state.event.status === "draft" || state.event.status === "registration_open";
  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) {
      return state.templates;
    }

    return state.templates.filter((template) =>
      [template.title, template.shortDescription, template.fullDescription].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [state.templates, templateQuery]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch(`/api/admin/events/${slug}/state`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not refresh admin dashboard.");
        }

        if (!cancelled) {
          setState(payload);
          setEventTitle(payload.event.title);
          setTargetTeamSize(String(payload.event.targetTeamSize));
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Refresh failed.");
        }
      }
    }

    const interval = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [slug]);

  async function refreshNow() {
    const response = await fetch(`/api/admin/events/${slug}/state`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not refresh admin state.");
    }
    setState(payload);
  }

  async function requestJson(
    path: string,
    action: string,
    options?: {
      method?: "POST" | "DELETE";
      body?: Record<string, unknown>;
      successMessage?: string;
    },
  ) {
    setBusyAction(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(path, {
        method: options?.method ?? "POST",
        headers: options?.body
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed.");
      }

      setMessage(options?.successMessage ?? "Saved.");
      await refreshNow();
      return payload;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed.");
      throw requestError;
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadImage(
    file: File,
    kind: "task" | "template",
    action: string,
  ): Promise<ImageState> {
    setBusyAction(action);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);

      const response = await fetch("/api/admin/task-images", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Image upload failed.");
      }

      setMessage("Image uploaded.");
      return payload.image as ImageState;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
      throw uploadError;
    } finally {
      setBusyAction(null);
    }
  }

  function postJson(path: string, body: Record<string, unknown>, action: string, successMessage?: string) {
    return requestJson(path, action, {
      method: "POST",
      body,
      successMessage,
    });
  }

  function deleteJson(path: string, action: string, successMessage?: string) {
    return requestJson(path, action, {
      method: "DELETE",
      successMessage,
    });
  }

  function getTeamName(teamId: string) {
    return state.teams.find((team) => team.id === teamId)?.displayName ?? "Unknown team";
  }

  const tabs: Array<{ id: AdminTab; label: string; count?: number }> = [
    { id: "challenges", label: "Challenges", count: state.challenges.length },
    { id: "tasks", label: "Tasks", count: state.tasks.length },
    { id: "people", label: "People", count: state.registrations.length },
    { id: "standings", label: "Standings", count: state.teams.length },
    { id: "settings", label: "Settings" },
    { id: "audit", label: "Audit", count: Math.min(state.auditLog.length, 12) },
  ];

  return (
    <div className="space-y-6">
      <Panel className="bg-gradient-to-r from-white via-white to-sand/50">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <Badge tone={state.event.status === "live" ? "accent" : "default"}>
              {state.event.status.replace("_", " ")}
            </Badge>
            <SectionHeading
              eyebrow="Admin control"
              title={state.event.title}
              description={`${state.registrations.length} players registered.`}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink/70">
              <span>Join code</span>
              <JoinCodeBadge code={state.event.joinCode} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.event.status === "draft" ? (
              <Button
                tone="secondary"
                disabled={busyAction === "open_registration"}
                onClick={() =>
                  postJson(
                    `/api/admin/events/${slug}`,
                    { action: "open_registration" },
                    "open_registration",
                  )
                }
              >
                Open registration
              </Button>
            ) : null}
            {state.event.status === "registration_open" ? (
              <Button
                disabled={busyAction === "start_game"}
                onClick={() => postJson(`/api/admin/events/${slug}/start`, {}, "start_game")}
              >
                Start game
              </Button>
            ) : null}
            {state.event.status === "live" ? (
              <Button
                tone="danger"
                disabled={busyAction === "end_game"}
                onClick={() => postJson(`/api/admin/events/${slug}/end`, {}, "end_game")}
              >
                End game
              </Button>
            ) : null}
            {state.event.status === "live" || state.event.status === "ended" ? (
              <Button
                tone="secondary"
                disabled={busyAction === "restart_game"}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Reset the game back to registration with the same players and tasks? This will clear teams, boards, challenges, ratings, and locked team names until you start the game again.",
                    )
                  ) {
                    return;
                  }

                  postJson(
                    `/api/admin/events/${slug}/restart`,
                    {},
                    "restart_game",
                    "Game reset to registration.",
                  );
                }}
              >
                Restart game
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      {message ? <p className="rounded-2xl bg-mint/15 px-4 py-3 text-sm text-ink">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p> : null}

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap gap-2 rounded-full bg-ink/5 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? "min-h-11 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition"
                  : "min-h-11 rounded-full px-4 py-2 text-sm font-semibold text-ink/65 transition hover:bg-white/80"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {typeof tab.count === "number" ? ` (${tab.count})` : ""}
            </button>
          ))}
        </div>
      </Panel>

      <div className="space-y-6">
        {activeTab === "challenges" ? (
          <Panel className="xl:p-8">
            <SectionHeading
              eyebrow="Challenges"
              title="Live results and overrides"
              description="Override notes, winners, and statuses live without squeezing the context beside unrelated admin sections."
            />
            <div className="mt-6 space-y-4">
              {state.challenges.length === 0 ? (
                <p className="rounded-3xl bg-ink/5 px-4 py-4 text-sm text-ink/60">
                  No challenges have been created yet.
                </p>
              ) : null}
              {state.challenges.map((challenge) => (
                <form
                  key={challenge.id}
                  className="rounded-[2rem] border border-ink/8 bg-gradient-to-br from-white to-ink/5 p-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const winnerValue = String(formData.get("winnerTeamId") ?? "");
                    postJson(
                      `/api/admin/events/${slug}/challenges/${challenge.id}/override`,
                      {
                        status: String(formData.get("status") ?? "resolved"),
                        winnerTeamId: winnerValue ? winnerValue : null,
                        note: String(formData.get("note") ?? ""),
                      },
                      `override_${challenge.id}`,
                      "Challenge override saved.",
                    );
                  }}
                >
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-ink/45">{challenge.status}</p>
                          <h3 className="mt-2 text-xl font-semibold text-ink">{challenge.taskTitle}</h3>
                          <p className="mt-2 text-base text-ink/70">
                            {getTeamName(challenge.challengerTeamId)} vs {getTeamName(challenge.opponentTeamId)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={challenge.type === "competitive" ? "warning" : "success"}>
                            {challenge.type}
                          </Badge>
                          <Badge
                            tone={
                              challenge.status === "cancelled" || challenge.status === "failed"
                                ? "danger"
                                : "accent"
                            }
                          >
                            {challenge.winnerTeamId ? `Winner: ${getTeamName(challenge.winnerTeamId)}` : "No winner"}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-ink/40">Created</p>
                          <p className="mt-2 text-sm text-ink">
                            {new Date(challenge.createdAt).toLocaleString("en-GB")}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-ink/40">Resolved</p>
                          <p className="mt-2 text-sm text-ink">
                            {challenge.resolvedAt
                              ? new Date(challenge.resolvedAt).toLocaleString("en-GB")
                              : "Still open"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-ink/40">Challenge id</p>
                          <p className="mt-2 break-all text-sm text-ink/70">{challenge.id}</p>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-white/80 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-ink/40">Current note</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/75">
                          {challenge.note?.trim() ? challenge.note : "No note saved yet."}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-ink/8 bg-white/85 p-4">
                      <p className="text-sm font-semibold text-ink">Override controls</p>
                      <div className="mt-4 grid gap-3">
                        <Select name="status" defaultValue={challenge.status}>
                          <option value="resolved">Resolved</option>
                          <option value="failed">Failed</option>
                          <option value="cancelled">Cancelled</option>
                        </Select>
                        <Select
                          name="winnerTeamId"
                          defaultValue={challenge.winnerTeamId ?? ""}
                          disabled={challenge.type === "cooperative"}
                        >
                          <option value="">No winner</option>
                          <option value={challenge.challengerTeamId}>
                            {getTeamName(challenge.challengerTeamId)}
                          </option>
                          <option value={challenge.opponentTeamId}>
                            {getTeamName(challenge.opponentTeamId)}
                          </option>
                        </Select>
                        <Textarea
                          name="note"
                          className="min-h-[160px]"
                          defaultValue={challenge.note ?? ""}
                          placeholder="Explain why you are overriding the result, what happened, and what players should know."
                        />
                        <Button type="submit" disabled={busyAction === `override_${challenge.id}`}>
                          {busyAction === `override_${challenge.id}` ? "Saving..." : "Apply override"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              ))}
            </div>
          </Panel>
        ) : null}

        {activeTab === "settings" ? (
          <Panel>
            <SectionHeading
              eyebrow="Settings"
              title="Event settings"
              description="Title is always editable. Team size locks after the game goes live."
            />
            <form
              className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                postJson(
                  `/api/admin/events/${slug}`,
                  {
                    action: "update_event",
                    title: eventTitle,
                    targetTeamSize: Number(targetTeamSize),
                  },
                  "update_event",
                );
              }}
            >
              <Input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
              <Input
                type="number"
                min={1}
                max={10}
                value={targetTeamSize}
                onChange={(event) => setTargetTeamSize(event.target.value)}
              />
              <Button type="submit" disabled={busyAction === "update_event"}>
                {busyAction === "update_event" ? "Saving..." : "Save"}
              </Button>
            </form>
          </Panel>
        ) : null}

        {activeTab === "tasks" ? (
          <Panel>
            <SectionHeading
              eyebrow="Tasks"
              title={`Task deck (${activeTaskCount}/16 active)`}
              description="Create event-specific tasks, reuse global templates, and attach images that also show up in the player flow."
            />

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl bg-ink/5 p-4">
                <h3 className="text-lg font-semibold text-ink">Create task manually</h3>
                <form
                  className="mt-4 grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    postJson(
                      `/api/admin/events/${slug}/tasks`,
                      taskDraft,
                      "create_task",
                      "Task created.",
                    ).then(() => {
                      setTaskDraft(createEmptyTaskDraft());
                    });
                  }}
                >
                  <Input
                    placeholder="Task title"
                    value={taskDraft.title}
                    onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Short description"
                    value={taskDraft.shortDescription}
                    onChange={(event) =>
                      setTaskDraft((current) => ({ ...current, shortDescription: event.target.value }))
                    }
                    required
                  />
                  <Textarea
                    placeholder="Full description (Markdown supported)"
                    value={taskDraft.fullDescription}
                    onChange={(event) =>
                      setTaskDraft((current) => ({ ...current, fullDescription: event.target.value }))
                    }
                    required
                  />
                  <p className="text-xs text-ink/45">Supports Markdown like headings, lists, bold text, links, and code blocks.</p>

                  <div className="grid gap-3">
                    <ImagePreview imageUrl={taskDraft.imageUrl} alt="Task draft preview" />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }

                        const image = await uploadImage(file, "task", "upload_task_draft");
                        setTaskDraft((current) => ({ ...current, ...image }));
                      }}
                    />
                    {taskDraft.imageUrl ? (
                      <Button
                        type="button"
                        tone="ghost"
                        onClick={() => setTaskDraft((current) => ({ ...current, ...createEmptyImageState() }))}
                      >
                        Remove image
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Select
                      value={taskDraft.type}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          type: event.target.value as TaskType,
                        }))
                      }
                    >
                      <option value="competitive">Competitive</option>
                      <option value="cooperative">Cooperative</option>
                    </Select>
                    <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={taskDraft.isActive}
                        onChange={(event) =>
                          setTaskDraft((current) => ({ ...current, isActive: event.target.checked }))
                        }
                      />
                      Active task
                    </label>
                    <Button type="submit" disabled={busyAction === "create_task" || busyAction === "upload_task_draft"}>
                      {busyAction === "create_task" ? "Saving..." : "Add task"}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="rounded-3xl bg-sea/5 p-4">
                <h3 className="text-lg font-semibold text-ink">Global template library</h3>
                <p className="mt-2 text-sm text-ink/65">
                  Reuse these templates across future events without editing the shared library.
                </p>
                <Input
                  className="mt-4"
                  placeholder="Search templates"
                  value={templateQuery}
                  onChange={(event) => setTemplateQuery(event.target.value)}
                />
                <div className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-2">
                  {filteredTemplates.length === 0 ? (
                    <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-ink/60">
                      No templates match your search yet.
                    </p>
                  ) : null}
                  {filteredTemplates.map((template) => (
                    <div key={template.id} className="rounded-3xl bg-white/90 p-4 shadow-sm">
                      <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                        <ImagePreview imageUrl={template.imageUrl} alt={template.title} compact />
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">{template.title}</p>
                              <p className="mt-1 text-sm text-ink/60">{template.shortDescription}</p>
                            </div>
                            <Badge tone={template.type === "competitive" ? "accent" : "success"}>
                              {template.type}
                            </Badge>
                          </div>
                          <MarkdownContent content={template.fullDescription} className="text-ink/70" />
                          <p className="text-xs uppercase tracking-[0.22em] text-ink/40">
                            Updated {new Date(template.updatedAt).toLocaleDateString("en-GB")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              disabled={busyAction === `template_active_${template.id}`}
                              onClick={() =>
                                postJson(
                                  `/api/admin/events/${slug}/tasks/from-template`,
                                  { templateId: template.id, isActive: true },
                                  `template_active_${template.id}`,
                                  "Template added as an active task.",
                                )
                              }
                            >
                              Add active
                            </Button>
                            <Button
                              type="button"
                              tone="ghost"
                              disabled={busyAction === `template_inactive_${template.id}`}
                              onClick={() =>
                                postJson(
                                  `/api/admin/events/${slug}/tasks/from-template`,
                                  { templateId: template.id, isActive: false },
                                  `template_inactive_${template.id}`,
                                  "Template added as an inactive task.",
                                )
                              }
                            >
                              Add inactive
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-gold/10 p-4">
              <h3 className="text-lg font-semibold text-ink">Create global template</h3>
              <form
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  postJson(
                    `/api/admin/events/${slug}/task-templates`,
                    templateDraft,
                    "create_template",
                    "Template saved to the global library.",
                  ).then(() => {
                    setTemplateDraft(createEmptyTemplateDraft());
                  });
                }}
              >
                <Input
                  placeholder="Template title"
                  value={templateDraft.title}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, title: event.target.value }))}
                  required
                />
                <Input
                  placeholder="Short description"
                  value={templateDraft.shortDescription}
                  onChange={(event) =>
                    setTemplateDraft((current) => ({ ...current, shortDescription: event.target.value }))
                  }
                  required
                />
                <Textarea
                  placeholder="Full description (Markdown supported)"
                  value={templateDraft.fullDescription}
                  onChange={(event) =>
                    setTemplateDraft((current) => ({ ...current, fullDescription: event.target.value }))
                  }
                  required
                />
                <p className="text-xs text-ink/45">Supports Markdown like headings, lists, bold text, links, and code blocks.</p>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <ImagePreview imageUrl={templateDraft.imageUrl} alt="Template preview" />
                  <div className="grid gap-3">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }

                        const image = await uploadImage(file, "template", "upload_template_draft");
                        setTemplateDraft((current) => ({ ...current, ...image }));
                      }}
                    />
                    <Select
                      value={templateDraft.type}
                      onChange={(event) =>
                        setTemplateDraft((current) => ({
                          ...current,
                          type: event.target.value as TaskType,
                        }))
                      }
                    >
                      <option value="competitive">Competitive</option>
                      <option value="cooperative">Cooperative</option>
                    </Select>
                    <Button
                      type="submit"
                      disabled={busyAction === "create_template" || busyAction === "upload_template_draft"}
                    >
                      {busyAction === "create_template" ? "Saving..." : "Save template"}
                    </Button>
                    {templateDraft.imageUrl ? (
                      <Button
                        type="button"
                        tone="ghost"
                        onClick={() => setTemplateDraft((current) => ({ ...current, ...createEmptyImageState() }))}
                      >
                        Remove image
                      </Button>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>

            <div className="mt-6 space-y-4">
              {state.tasks.map((task) => {
                const taskImage = taskImageDrafts[task.id] ?? {
                  imagePath: task.imagePath ?? "",
                  imageUrl: task.imageUrl ?? "",
                };

                return (
                  <details key={task.id} className="rounded-3xl bg-ink/5 p-4">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-24 shrink-0">
                            <ImagePreview imageUrl={taskImage.imageUrl} alt={task.title} compact />
                          </div>
                          <div>
                            <p className="font-semibold text-ink">{task.title}</p>
                            <p className="text-sm text-ink/60">{task.shortDescription}</p>
                            <p className="mt-1 text-xs text-ink/50">
                              {task.ratingCount > 0
                                ? `${task.ratingAverage?.toFixed(1)}★ from ${task.ratingCount} ratings`
                                : "No ratings yet"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={task.type === "competitive" ? "accent" : "success"}>{task.type}</Badge>
                          <Badge tone={task.isActive ? "accent" : "default"}>
                            {task.isActive ? "active" : "inactive"}
                          </Badge>
                        </div>
                      </div>
                    </summary>
                    <form
                      className="mt-4 grid gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        postJson(
                          `/api/admin/events/${slug}/tasks/${task.id}`,
                          {
                            title: String(formData.get("title") ?? ""),
                            shortDescription: String(formData.get("shortDescription") ?? ""),
                            fullDescription: String(formData.get("fullDescription") ?? ""),
                            type: String(formData.get("type") ?? "competitive"),
                            isActive: formData.get("isActive") === "on",
                            imagePath: String(formData.get("imagePath") ?? ""),
                            imageUrl: String(formData.get("imageUrl") ?? ""),
                          },
                          `task_${task.id}`,
                          "Task updated.",
                        ).then(() => {
                          setTaskImageDrafts((current) => {
                            const next = { ...current };
                            delete next[task.id];
                            return next;
                          });
                        });
                      }}
                    >
                      <Input name="title" defaultValue={task.title} />
                      <Input name="shortDescription" defaultValue={task.shortDescription} />
                      <Textarea
                        name="fullDescription"
                        defaultValue={task.fullDescription}
                        placeholder="Full description (Markdown supported)"
                      />
                      <p className="text-xs text-ink/45">
                        Supports Markdown like headings, lists, bold text, links, and code blocks.
                      </p>

                      <input type="hidden" name="imagePath" value={taskImage.imagePath} readOnly />
                      <input type="hidden" name="imageUrl" value={taskImage.imageUrl} readOnly />

                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <ImagePreview imageUrl={taskImage.imageUrl} alt={task.title} />
                        <div className="grid gap-3">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (!file) {
                                return;
                              }

                              const image = await uploadImage(file, "task", `upload_task_${task.id}`);
                              setTaskImageDrafts((current) => ({ ...current, [task.id]: image }));
                            }}
                          />
                          <Button
                            type="button"
                            tone="ghost"
                            onClick={() =>
                              setTaskImageDrafts((current) => ({
                                ...current,
                                [task.id]: createEmptyImageState(),
                              }))
                            }
                          >
                            Remove image
                          </Button>
                          <Button
                            type="button"
                            tone="secondary"
                            disabled={busyAction === `save_template_${task.id}`}
                            onClick={() => {
                              const suggestedTitle = window.prompt("Template title", `${task.title}`);

                              if (suggestedTitle === null) {
                                return;
                              }

                              postJson(
                                `/api/admin/events/${slug}/tasks/${task.id}/template`,
                                { title: suggestedTitle },
                                `save_template_${task.id}`,
                                "Task saved as a global template.",
                              );
                            }}
                          >
                            Save as template
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <Select name="type" defaultValue={task.type}>
                          <option value="competitive">Competitive</option>
                          <option value="cooperative">Cooperative</option>
                        </Select>
                        <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
                          <input name="isActive" type="checkbox" defaultChecked={task.isActive} />
                          Active task
                        </label>
                        <Button
                          type="submit"
                          disabled={busyAction === `task_${task.id}` || busyAction === `upload_task_${task.id}`}
                        >
                          {busyAction === `task_${task.id}` ? "Saving..." : "Update task"}
                        </Button>
                      </div>
                    </form>
                  </details>
                );
              })}
            </div>
          </Panel>
        ) : null}

        {activeTab === "people" ? (
          <>
            <Panel>
              <SectionHeading
                eyebrow="Registrations"
                title={`${state.registrations.length} players`}
                description={
                  canManageRegistrations
                    ? "Players appear here as soon as they register. You can remove registrations before the game starts."
                    : "Player removals lock once the game has started."
                }
              />
              <div className="mt-5 space-y-3">
                {state.registrations.length === 0 ? (
                  <p className="rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink/60">
                    No players have registered yet.
                  </p>
                ) : null}
                {state.registrations.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-ink/5 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-ink">{player.displayName}</p>
                      <p className="text-sm text-ink/55">
                        {player.email ? `${player.email} • ` : ""}
                        {player.teamId ? "Assigned" : "Waiting"}
                      </p>
                    </div>
                    {canManageRegistrations ? (
                      <Button
                        tone="danger"
                        disabled={busyAction === `remove_registration_${player.id}`}
                        onClick={() => {
                          if (!window.confirm(`Remove ${player.displayName} from this event?`)) {
                            return;
                          }

                          deleteJson(
                            `/api/admin/events/${slug}/registrations/${player.id}`,
                            `remove_registration_${player.id}`,
                            "Player removed.",
                          );
                        }}
                      >
                        {busyAction === `remove_registration_${player.id}` ? "Removing..." : "Remove"}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionHeading
                eyebrow="Teams"
                title={`${state.teams.length} teams`}
                description="Switch captains instantly if you need to rebalance leadership."
              />
              <div className="mt-5 space-y-4">
                {state.teams.map((team) => (
                  <form
                    key={team.id}
                    className="rounded-3xl bg-ink/5 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      postJson(
                        `/api/admin/events/${slug}/captain`,
                        {
                          teamId: team.id,
                          playerId: String(formData.get("playerId") ?? ""),
                        },
                        `captain_${team.id}`,
                      );
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-ink">{team.displayName}</p>
                        <p className="text-sm text-ink/60">{team.completedCount} tasks completed</p>
                      </div>
                      <Badge tone="accent">{team.members.length} members</Badge>
                    </div>
                    <div className="mt-4 space-y-2">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3"
                        >
                          <p className="font-medium text-ink">{member.displayName}</p>
                          {member.isCaptain ? <Badge tone="accent">Captain</Badge> : null}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <Select name="playerId" defaultValue={team.captainPlayerId ?? undefined}>
                        {team.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.displayName}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" disabled={busyAction === `captain_${team.id}`}>
                        {busyAction === `captain_${team.id}` ? "Switching..." : "Switch captain"}
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            </Panel>
          </>
        ) : null}

        {activeTab === "standings" ? (
          <Panel>
            <SectionHeading
              eyebrow="Leaderboard"
              title="Current standings"
              description="Sorted only by completed tasks."
            />
            <div className="mt-5 space-y-3">
              {state.leaderboard.map((team, index) => (
                <div key={team.teamId} className="rounded-3xl bg-ink/5 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">#{index + 1}</p>
                      <p className="font-semibold text-ink">{team.teamName}</p>
                    </div>
                    <p className="text-xl font-semibold text-ink">{team.completedCount}</p>
                  </div>
                  <p className="mt-2 text-xs text-ink/55">
                    Gold {team.goldCount} • Diamond {team.platinumCount}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {activeTab === "audit" ? (
          <Panel>
            <SectionHeading
              eyebrow="Audit"
              title="Recent admin actions"
              description="Every overwrite and control change is logged for cleanup."
            />
            <div className="mt-5 space-y-3">
              {state.auditLog.slice(0, 12).map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-ink/5 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{entry.actionType}</p>
                  <p className="text-xs text-ink/55">
                    {new Date(entry.createdAt).toLocaleString("en-GB")} • {entry.entityType}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
