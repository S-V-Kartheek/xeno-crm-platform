import SegmentBuilder from "../SegmentBuilder";

export const metadata = {
  title: "New Segment | SmartCRM",
  description: "Build a new customer audience segment"
};

export default function NewSegmentPage() {
  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>New segment</h1>
          <p className="muted">
            Build rule filters manually, or describe your audience in plain English and let AI
            generate the rules.
          </p>
        </div>
      </header>
      <SegmentBuilder mode="create" />
    </div>
  );
}
