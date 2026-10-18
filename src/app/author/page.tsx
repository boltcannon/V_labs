/**
 * /author — Teacher authoring wizard.
 *
 * Renders the full 12-step wizard for creating a new lab spec.
 * The wizard validates through the identical Zod schema as the
 * loader (Principle 9) and writes to src/specs/.
 */

import { WizardShell } from "@/components/author/wizard-shell";

export const metadata = {
  title: "Author New Lab — vlab-framework",
};

export default function AuthorPage() {
  return <WizardShell />;
}
