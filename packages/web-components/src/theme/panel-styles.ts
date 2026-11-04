import { css } from "lit";
import type { CSSResult } from "lit";

/**
 * Nested panels - an outlined `<wa-details>` or an accordion item - alternate between the
 * surface and `--cofy-surface-alt`, so a panel inside another stands out from it.
 *
 * Each panel hands its content the two swapped. The panel's own values are captured under other
 * names first, as a property set from itself on one element would be a cycle. By default
 * `--cofy-surface-alt` is the surface itself, so nothing changes until a theme sets it.
 */
export const panelStyles: CSSResult = css`
  wa-details:not([appearance="plain"]),
  wa-accordion-item {
    --cofy-panel-surface: var(--wa-color-surface-default);
    --cofy-panel-surface-alt: var(--cofy-surface-alt);
  }
  wa-details:not([appearance="plain"]) > *,
  wa-accordion-item > * {
    --wa-color-surface-default: var(--cofy-panel-surface-alt);
    --cofy-surface-alt: var(--cofy-panel-surface);
  }
`;
