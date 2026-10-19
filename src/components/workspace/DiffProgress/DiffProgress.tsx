import type { CSSProperties } from "react";
import { Panel } from "#/components/ui/Panel/Panel.tsx";
import { Spinner } from "#/components/ui/Spinner/Spinner.tsx";
import {
	type BuildProgress,
	failuresOf,
	type StepFailure,
	type StepState,
} from "#/lib/session/buildProgress.ts";
import { FailureMessage } from "../FailureNotice/FailureNotice.tsx";
import styles from "./DiffProgress.module.css";

interface Step {
	id: "from" | "to" | "diff";
	label: string;
	state: StepState;
}

const STATE_NAMES: Record<StepState, string> = {
	waiting: "Waiting",
	running: "In progress",
	done: "Done",
	failed: "Failed",
};

interface DiffProgressProps {
	packageName: string;
	from: string;
	to: string;
	progress: BuildProgress;
}

export function DiffProgress({
	packageName,
	from,
	to,
	progress,
}: DiffProgressProps) {
	const steps: Step[] = [
		{
			id: "from",
			label: `Fetching ${packageName} ${from}`,
			state: progress.from.state,
		},
		{
			id: "to",
			label: `Fetching ${packageName} ${to}`,
			state: progress.to.state,
		},
		{ id: "diff", label: "Diffing", state: progress.diff.state },
	];
	const failures = failuresOf(progress);
	const stepCount = { "--step-count": steps.length } as CSSProperties;

	return (
		<div className={styles.stage} style={stepCount}>
			<Panel className={styles.box} data-testid="diff-progress">
				<ol className={styles.steps}>
					{steps.map((step) => (
						<ProgressStep key={step.id} {...step} />
					))}
				</ol>
				{failures.length > 0 && <Failures failures={failures} />}
			</Panel>
		</div>
	);
}

function ProgressStep({ id, label, state }: Step) {
	return (
		<li
			className={styles.step}
			data-testid={`progress-${id}`}
			data-state={state}
		>
			<span className={styles.indicator}>
				{state === "running" ? (
					<Spinner label={STATE_NAMES.running} />
				) : (
					<span
						className={styles.dot}
						data-state={state}
						role="img"
						aria-label={STATE_NAMES[state]}
					/>
				)}
			</span>
			<span className={styles.label} title={label}>
				{label}
			</span>
		</li>
	);
}

function Failures({ failures }: { failures: StepFailure[] }) {
	return (
		<div className={styles.failures}>
			{failures.map(({ step, failure }) => (
				<FailureMessage key={step} {...failure} testId="diff-error" />
			))}
		</div>
	);
}
