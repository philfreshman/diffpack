import { useState } from "react";
import {
	GallerySection,
	SpecimenCell,
	SpecimenGrid,
} from "#/components/design/GallerySection/GallerySection.tsx";
import { GALLERY_SECTIONS } from "#/components/design/gallerySections.ts";
import { Button } from "#/components/ui/Button/Button.tsx";
import { Combobox } from "#/components/ui/Combobox/Combobox.tsx";
import { IconButton } from "#/components/ui/IconButton/IconButton.tsx";
import {
	CloseIcon,
	DotsVerticalIcon,
	DownloadIcon,
	SearchIcon,
	SettingsIcon,
	SplitViewIcon,
} from "#/components/ui/icons.tsx";
import { Kbd } from "#/components/ui/Kbd/Kbd.tsx";
import { Menu, MenuLinkItem } from "#/components/ui/Menu/Menu.tsx";
import { Notice, NoticeText } from "#/components/ui/Notice/Notice.tsx";
import {
	ChoiceOption,
	FoldOutOption,
	OptionsMenu,
	ToggleOption,
} from "#/components/ui/OptionsMenu/OptionsMenu.tsx";
import { Panel } from "#/components/ui/Panel/Panel.tsx";
import { Spinner } from "#/components/ui/Spinner/Spinner.tsx";
import { SeverityBadge } from "#/components/workspace/SeverityBadge/SeverityBadge.tsx";
import type { Severity } from "#/lib/vulnerabilities/types.ts";
import iconButtonStyles from "#/components/ui/IconButton/IconButton.module.css";
import popoverStyles from "#/components/ui/Popover/Popover.module.css";
import styles from "./PrimitiveSpecimens.module.css";

const SEVERITIES: readonly Severity[] = [
	"critical",
	"high",
	"moderate",
	"low",
	"unknown",
];

const PACKAGE_NAMES = ["react", "react-dom", "react-router", "redux", "rxjs"];

const DENSITIES = ["Compact", "Comfortable"] as const;

type Density = (typeof DENSITIES)[number];

export function PrimitiveSpecimens() {
	return (
		<GallerySection id="primitives" source="src/components/ui">
			<SpecimenGrid cellWidth="wide">
				<SpecimenCell label="Button · neutral, primary, disabled">
					<Button>Compare</Button>
					<Button variant="primary">Compare</Button>
					<Button disabled>Compare</Button>
				</SpecimenCell>
				<SpecimenCell label="IconButton · one disabled">
					<IconButton aria-label="Search">
						<SearchIcon />
					</IconButton>
					<IconButton aria-label="Download">
						<DownloadIcon />
					</IconButton>
					<IconButton aria-label="Split view">
						<SplitViewIcon />
					</IconButton>
					<IconButton aria-label="Close" disabled>
						<CloseIcon />
					</IconButton>
				</SpecimenCell>
				<SpecimenCell label="Kbd · Spinner">
					<Kbd keys="/" />
					<Kbd keys="Esc" />
					<Spinner />
				</SpecimenCell>
				<SpecimenCell label="Combobox">
					<ComboboxSpecimen />
				</SpecimenCell>
				<SpecimenCell label="Menu · MenuLinkItem">
					<Menu
						label="Jump to section"
						trigger={<DotsVerticalIcon />}
						triggerClassName={iconButtonStyles.iconButton}
					>
						{GALLERY_SECTIONS.map(({ id, title }) => (
							<MenuLinkItem key={id} render={<a href={`#${id}`} />}>
								{title}
							</MenuLinkItem>
						))}
					</Menu>
				</SpecimenCell>
				<SpecimenCell label="OptionsMenu · ToggleOption · FoldOutOption">
					<OptionsMenuSpecimen />
				</SpecimenCell>
				<SpecimenCell label="popoverStyles.surface · .item">
					<div className={`${popoverStyles.surface} ${styles.staticPopover}`}>
						<div className={popoverStyles.item}>react</div>
						<div className={popoverStyles.item} data-highlighted="">
							react-dom
						</div>
						<div className={popoverStyles.item}>react-router</div>
					</div>
				</SpecimenCell>
				<SpecimenCell label="Panel · NoticeText">
					<Panel>
						<NoticeText title="3 advisories">
							<p className={styles.detail}>Both versions were checked.</p>
						</NoticeText>
					</Panel>
				</SpecimenCell>
				<SpecimenCell label='Notice tone="neutral"'>
					<Notice title="Composer is resting">
						<p className={styles.detail}>It comes back at 00:00 UTC.</p>
					</Notice>
				</SpecimenCell>
				<SpecimenCell label='Notice tone="danger"'>
					<Notice tone="danger" title="Could not download react@99.0.0">
						<p className={styles.detail}>The registry has no such version.</p>
					</Notice>
				</SpecimenCell>
				<SpecimenCell label="SeverityBadge">
					{SEVERITIES.map((severity) => (
						<SeverityBadge key={severity} severity={severity} />
					))}
				</SpecimenCell>
				<SpecimenCell label="text link · --underline-offset">
					<a className={styles.textLink} href="#primitives">
						GHSA-xvch-5gv4-984h
					</a>
				</SpecimenCell>
			</SpecimenGrid>
		</GallerySection>
	);
}

function ComboboxSpecimen() {
	const [query, setQuery] = useState("");

	return (
		<Combobox
			label="Package"
			items={PACKAGE_NAMES}
			inputValue={query}
			onInputValueChange={setQuery}
			onSelect={(name) => setQuery(name)}
			itemToText={(name) => name}
			placeholder="Search npm…"
			leading={<SearchIcon width="16" height="16" />}
		/>
	);
}

function OptionsMenuSpecimen() {
	const [wrapLines, setWrapLines] = useState(true);
	const [density, setDensity] = useState<Density>("Compact");

	return (
		<OptionsMenu label="Options" icon={<SettingsIcon width="16" height="16" />}>
			<ToggleOption label="Wrap lines" on={wrapLines} onChange={setWrapLines} />
			<FoldOutOption
				label="Density"
				value={density}
				side="right"
				testId="gallery-density"
			>
				{DENSITIES.map((choice) => (
					<ChoiceOption
						key={choice}
						label={choice}
						chosen={choice === density}
						onChoose={() => setDensity(choice)}
					/>
				))}
			</FoldOutOption>
		</OptionsMenu>
	);
}
