
import {
  Copy,
  FileSearch,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "wouter";

import {
  checkFile,
  copyText,
  MAX_FILES,
  toBase64,
} from "../_core/files";
import { getCode, saveCode } from "../_core/codes";
import {
  errorMessage,
  trpc,
  type PublicCase,
} from "../_core/trpc";
import {
  ProgressBar,
  SlaChip,
  StatusBadge,
  Stars,
  Timeline,
  PriorityBadge,
} from "../components/CaseParts";
import DocketSearch from "../components/DocketSearch";
import PublicShell from "../components/PublicShell";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  inputCls,
  PageHeader,
  Pill,
  Spinner,
  textareaCls,
} from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../hooks/useToast";

function Actions({ c }: { c: PublicCase }) {
  const notify = useToast();
  const utils = trpc.useUtils();
  const tn = c.trackingNumber;

  const [code, setCode] = useState(getCode(tn));
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const valid = trpc.portal.checkAccess.useQuery(
    { trackingNumber: tn, accessCode: code },
    { enabled: code.length >= 8 }
  );

  const done = () => {
    setErr("");
    void utils.portal.detail.invalidate();
  };

  const onError = (e: unknown) => {
    setErr(errorMessage(e));
  };

  const reopen = trpc.portal.reopen.useMutation({
    onSuccess: () => {
      notify("Case reopened. The department has been notified.");
      setReason("");
      done();
    },
    onError,
  });

  const rate = trpc.portal.feedback.useMutation({
    onSuccess: () => {
      notify("Thank you for your feedback.");
      setComment("");
      setScore(0);
      done();
    },
    onError,
  });

  const upload = trpc.portal.uploadAttachment.useMutation({
    onSuccess: () => {
      notify("Evidence added.");
      done();
    },
    onError,
  });

  if (!valid.data) {
    return (
      <div className="rounded-2xl bg-surface2 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={16} className="text-blue" aria-hidden />
          Filed this case? Unlock your options.
        </p>

        <p className="mt-1 text-sm text-mute">
          Enter the access code you were given at filing to add evidence,
          rate the outcome or reopen a resolved case.
        </p>

        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const value = draft.trim().toUpperCase();
            setCode(value);
            saveCode(tn, value);
          }}
        >
          <input
            aria-label="Access code"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ABCD-2345"
            className={`${inputCls} !h-12 max-w-56 font-mono uppercase tracking-widest`}
          />

          <Button variant="dark" type="submit">
            Unlock
          </Button>
        </form>

        {valid.isError ||
        (valid.isFetched && valid.data === false) ? (
          <ErrorNote>
            That access code does not match this case.
          </ErrorNote>
        ) : null}
      </div>
    );
  }

  async function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []);

    if (!files.length) return;

    if (c.attachments.length + files.length > MAX_FILES) {
      setErr(`A case can hold up to ${MAX_FILES} files.`);
      return;
    }

    for (const file of files) {
      const problem = checkFile(file);

      if (problem) {
        setErr(problem);
        return;
      }

      try {
        await upload.mutateAsync({
          trackingNumber: tn,
          accessCode: code,
          filename: file.name,
          dataBase64: await toBase64(file),
        });
      } catch {
        return;
      }
    }

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <Pill tone="green">
        <ShieldCheck size={13} aria-hidden />
        Verified as the person who filed this case
      </Pill>

      {c.canRate && (
        <div className="rounded-2xl bg-green-soft p-6">
          <p className="font-semibold text-green">
            How did we do?
          </p>

          <p className="mt-2 text-sm text-mute">
            Select a rating from 1 to 5 stars.
          </p>

          <div
            className="mt-3 flex items-center gap-2"
            role="group"
            aria-label="Rate your experience from 1 to 5 stars"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                aria-pressed={score === value}
                onClick={() => {
                  setScore(value);
                  setErr("");
                }}
                className={`rounded-lg p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue ${
                  value <= score
                    ? "text-amber-500"
                    : "text-gray-400 hover:text-amber-500"
                }`}
              >
                <Star
                  size={30}
                  fill={value <= score ? "currentColor" : "none"}
                  strokeWidth={1.8}
                />
              </button>
            ))}
          </div>

          <p className="mt-1 text-sm font-medium" aria-live="polite">
            {score === 0
              ? "No rating selected"
              : `${score} out of 5 stars selected`}
          </p>

          <textarea
            aria-label="Comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="Optional comment"
            className={`${textareaCls} mt-4 min-h-20 bg-surface`}
          />

          <Button
            type="button"
            className="mt-4"
            disabled={score === 0 || rate.isPending}
            onClick={() => {
              setErr("");

              if (score < 1 || score > 5) {
                setErr("Please select a rating from 1 to 5 stars.");
                return;
              }

              rate.mutate({
                trackingNumber: tn,
                accessCode: code,
                score,
                comment: comment.trim(),
              });
            }}
          >
            {rate.isPending
              ? "Submitting..."
              : score === 0
                ? "Select a star rating first"
                : "Submit rating"}
          </Button>
        </div>
      )}

      {c.canReopen && (
        <div className="rounded-2xl bg-amber-soft p-6">
          <p className="font-semibold text-amber">
            Not actually fixed?
          </p>

          <Field label="Tell us what is still wrong">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${textareaCls} min-h-24`}
              maxLength={1000}
            />
          </Field>

          <Button
            className="mt-4"
            variant="dark"
            disabled={reason.trim().length < 10 || reopen.isPending}
            onClick={() =>
              reopen.mutate({
                trackingNumber: tn,
                accessCode: code,
                reason: reason.trim(),
              })
            }
          >
            {reopen.isPending ? "Reopening..." : "Reopen this case"}
          </Button>
        </div>
      )}

      {!["resolved", "closed"].includes(c.status) && (
        <div>
          <input
            ref={fileRef}
            id="more-evidence"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => void addFiles(e.target.files)}
          />

          <label
            htmlFor="more-evidence"
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-6 text-[15px] font-semibold hover:bg-surface2"
          >
            <Paperclip size={16} aria-hidden />
            Add photos or documents
          </label>
        </div>
      )}

      {err && <ErrorNote>{err}</ErrorNote>}
    </div>
  );
}

function Result({ tn }: { tn: string }) {
  const notify = useToast();

  const q = trpc.portal.detail.useQuery({
    trackingNumber: tn,
  });

  const code = getCode(tn);

  const verified = trpc.portal.checkAccess.useQuery(
    {
      trackingNumber: tn,
      accessCode: code,
    },
    { enabled: code.length >= 8 }
  );

  useDocumentTitle(tn);

  if (q.isLoading) {
    return <Spinner />;
  }

  if (q.error || !q.data) {
    return (
      <Card>
        <p role="alert" className="text-center text-lg font-semibold">
          We could not find a case with that tracking number.
        </p>
        <p className="mt-2 text-center text-mute">
          Check the number for typos. It looks like GRV-2026-00001.
        </p>
      </Card>
    );
  }

  const c = q.data;

  return (
    <Card className="p-7 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={async () =>
              notify(
                (await copyText(c.trackingNumber))
                  ? "Tracking number copied."
                  : "Could not copy. Select it manually."
              )
            }
            className="flex cursor-pointer items-center gap-2 font-mono text-sm font-medium tracking-wider text-faint hover:text-ink"
            aria-label={`Copy tracking number ${c.trackingNumber}`}
          >
            {c.trackingNumber}
            <Copy size={14} aria-hidden />
          </button>

          <h2 className="mt-2 text-4xl leading-tight sm:text-5xl">
            {c.title}
          </h2>

          <p className="mt-3 text-mute">
            {c.department} · {c.category}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={c.status} />
          <PriorityBadge priority={c.priority} />
          <SlaChip
            status={c.status}
            targetDate={c.targetDate}
            resolvedAt={c.resolvedAt}
          />
        </div>
      </div>

      {c.maskedEmail && (
        <p className="mt-5 text-sm text-mute">
          Contact on file:{" "}
          <span className="font-mono">{c.maskedEmail}</span>
          {" "}(masked for your privacy)
        </p>
      )}

      <div className="mt-9">
        <ProgressBar stage={c.stage} />
      </div>

      {c.escalated && (
        <p className="mt-6 rounded-2xl bg-red-soft px-4 py-3 text-sm font-medium text-red">
          This case passed its statutory deadline and was escalated
          for executive attention.
        </p>
      )}

      <h3 className="mt-10 text-2xl">Reported issue</h3>

      <p className="mt-2 whitespace-pre-wrap text-[16px] leading-relaxed text-mute">
        {c.description}
      </p>

      {c.attachments.length > 0 && (
        <div className="mt-6">
          <h3 className="text-2xl">Evidence</h3>

          <ul className="mt-3 flex flex-wrap gap-3">
            {c.attachments.map((a) =>
              verified.data ? (
                <li key={a.key}>
                  <a
                    className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-blue hover:bg-surface2"
                    target="_blank"
                    rel="noreferrer"
                    href={`/api/attachments/${a.key}?trackingNumber=${c.trackingNumber}&accessCode=${encodeURIComponent(code)}`}
                  >
                    <Paperclip size={14} aria-hidden />
                    {a.filename}
                  </a>
                </li>
              ) : (
                <li
                  key={a.key}
                  className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-mute"
                >
                  <Paperclip size={14} aria-hidden />
                  {a.filename}
                </li>
              )
            )}
          </ul>

          {!verified.data && (
            <p className="mt-2 text-xs text-faint">
              Files open for the person who filed the case.
              Enter your access code below.
            </p>
          )}
        </div>
      )}

      {c.feedbackScore !== null && (
        <div className="mt-6 flex items-center gap-3">
          <Stars value={c.feedbackScore} size={20} />
          <span className="text-sm text-mute">
            Citizen rating
            {c.feedbackComment ? `: ${c.feedbackComment}` : ""}
          </span>
        </div>
      )}

      <h3 className="mt-10 text-2xl">Audit trail</h3>

      <div className="mt-5">
        <Timeline items={c.timeline} />
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <Actions c={c} />
      </div>
    </Card>
  );
}

export default function Track() {
  const { trackingNumber } = useParams<{
    trackingNumber?: string;
  }>();

  useDocumentTitle("Public Case Tracker");

  return (
    <PublicShell>
      <section className="px-5 pb-10 pt-16 text-center sm:px-12 sm:pt-20">
        <PageHeader
          center
          eyebrow="Public Case Docket"
          title="Where is your case now?"
          sub="Enter your tracking reference to inspect live handling status, assigned department oversight, and guaranteed resolution milestones. No sign-in required."
        />

        <DocketSearch
          className="mt-12"
          initial={trackingNumber ?? ""}
        />

        <p className="mt-6 text-[17px] text-mute">
          Or inspect recent filings on the{" "}
          <Link
            href="/board"
            className="border-b border-blue/40 font-medium text-blue hover:border-blue"
          >
            Public Grievance Ledger
          </Link>{" "}
          →
        </p>
      </section>

      <section className="mx-auto max-w-[1260px] px-5 pb-28 sm:px-12">
        {trackingNumber ? (
          <div className="mx-auto max-w-[1000px]">
            <Result
              key={trackingNumber}
              tn={trackingNumber.toUpperCase()}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              [
                <FileSearch size={24} key="1" />,
                "bg-blue-soft text-blue",
                "Live status",
                "See the current stage, the assigned department and every update as it is recorded.",
              ],
              [
                <ShieldCheck size={24} key="2" />,
                "bg-green-soft text-green",
                "Private by design",
                "Contact details are masked and street addresses are never shown on public pages.",
              ],
              [
                <Sparkles size={24} key="3" />,
                "bg-amber-soft text-amber",
                "Deadlines that count",
                "Each case carries a statutory window. Overdue cases are escalated automatically.",
              ],
            ].map(([icon, tone, heading, description]) => (
              <Card
                key={heading as string}
                className="p-8"
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full ${tone as string}`}
                >
                  {icon}
                </span>

                <h3 className="mt-6 text-3xl">
                  {heading as string}
                </h3>

                <p className="mt-3 text-[15px] text-mute">
                  {description as string}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
