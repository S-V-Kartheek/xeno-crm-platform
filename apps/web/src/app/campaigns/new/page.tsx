import CampaignWizard from "../CampaignWizard";

export const metadata = { title: "New Campaign | SmartCRM" };

export default function NewCampaignPage() {
  return (
    <div className="page-campaigns">
      <h1>New Campaign</h1>
      <p className="page-subtitle">Follow the steps to create and send a targeted campaign.</p>
      <CampaignWizard />
    </div>
  );
}
