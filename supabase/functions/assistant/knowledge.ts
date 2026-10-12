export type Article = {
  title: string;
  screen: string;
  keywords: string;
  steps: string;
};

export const ARTICLES: Article[] = [
  {
    title: "How to add a wedding",
    screen: "Weddings",
    keywords: "create new wedding file add wedding manual",
    steps: "There are two ways, and they are not the same. To type a file in yourself: open Weddings and click Add Wedding. Enter the couple, date, and venue, then save. That file stays in the area selected in the header. To sell a wedding: use Proposals, not Add Wedding. When the couple pays, the file is booked and shows up to review.",
  },
  {
    title: "How to build and send a proposal",
    screen: "Proposals",
    keywords: "proposal package add-ons send quote contract archive delete client name",
    steps: "Open Proposals and start a new one. The client name must be a first and last name in that one field. Pick the package and add-ons, check that the payment plan balances, then send the share link. Do not delete a proposal. Archive it. Archived proposals stay in the Archive tab for this area and can be restored, with the salesperson still attached. Training video: How to build a proposal in Veydra.",
  },
  {
    title: "How to review and publish a booked wedding",
    screen: "Weddings",
    keywords: "review wedding publish booked deposit line items hours photo video",
    steps: "After a couple pays, the wedding sits in review. Open it from Weddings. The review shows the package, the hours of photo and video, and what they paid. Publishing makes it a real upcoming wedding and posts the open positions. If contractors were already placed on a coverage request, check Assignments after publish.",
  },
  {
    title: "How to add an event to a wedding",
    screen: "Weddings",
    keywords: "engagement bartending sangeet extra date second day event position",
    steps: "Open the wedding, then Events. Add the extra date and its venue. Then add the position on that date, not on the wedding day. An unassigned position posts like any other open job for that area and the regions on that event. The couple sees the extra date on their portal. Post-production can get its own row if that date needs an edit before the wedding. Training video: How to add an event to an existing wedding.",
  },
  {
    title: "How to post a position and tell the team",
    screen: "Weddings",
    keywords: "job position open role region notify text email photographer videographer",
    steps: "On the wedding, or on an event under that wedding, add the role and leave it unassigned. Save it. That opens the job for contractors in that area whose region matches the wedding regions. A job can have more than one region when the venue sits between two. The open job is what they see under Jobs.",
  },
  {
    title: "How assignments work",
    screen: "Assignments",
    keywords: "assigned contractor confirm attendance upcoming call sheet",
    steps: "Assignments lists who is already on a job. A contractor only sees a wedding they are assigned to, in their region. If they cannot see it, open the assignment and check that the status is Upcoming, not Cancelled, and that the job region matches their region. Confirm attendance is on their assignment. The call sheet uses the questionnaire for that wedding.",
  },
  {
    title: "How post-production works",
    screen: "Post-Production",
    keywords: "editing editor delivered invoice songs deadline raw media",
    steps: "Post-Production is sorted with the next date first, not weddings that are years out. A row moves from awaiting raw media, to ready to edit, in progress, client review, revisions requested, then delivered. An early event, such as an engagement, gets its own row when it should be edited before the wedding. The company name on the row is the area's company, not the territory nickname. Training video: How to process a wedding post production.",
  },
  {
    title: "How to read the dashboard",
    screen: "Dashboard",
    keywords: "home action items numbers overview",
    steps: "Dashboard is the home screen for the area selected in the header. It is not a mix of every area. Quick Actions can message the team, jump to Add Wedding, or invite a contractor. Training video: How to read the dashboard in Veydra.",
  },
  {
    title: "How applications and training work",
    screen: "Applications",
    keywords: "applicant hire interview pipeline training test redo active contractor",
    steps: "Applications is the hiring pipeline for this area. Moving someone to hired does not skip training. An active contractor who already passed training should not be asked to take it again. If they are, they are signed in with an email that is not the contractor row that has training completed. They must use the email on that row.",
  },
  {
    title: "How to manage contractors",
    screen: "Contractors",
    keywords: "crew roster region specialty invite stripe w9",
    steps: "Contractors shows the crew for the area selected in the header, not every area. Invite sends them into this area. Their region controls which open jobs they see. A venue that sits between two regions can be posted to both. Their Stripe connect uses this area's contractor payout key, set in Settings.",
  },
  {
    title: "How messages work",
    screen: "Messages",
    keywords: "text email contractors message team",
    steps: "Messages only lists active contractors in the area selected in the header. If another area's people are in the list, the header area is wrong. Sending uses this area's Ovanta connection.",
  },
  {
    title: "How to add a manager or owner to an area",
    screen: "Team Management",
    keywords: "team admin manager owner area access home area picker",
    steps: "Team Management is where a person is given one or more areas. Their home area is what loads first when they sign in. After that they can switch only among the areas on their row. A manager of Tennessee who is also on North Carolina sees the picker. A manager of one area does not.",
  },
  {
    title: "How payouts work",
    screen: "Payouts",
    keywords: "pay contractor venmo stripe assignment paid",
    steps: "Payouts are for contractors on this area's weddings. A contractor can be paid by Venmo or by the Stripe account they connected for this area. Do not pay a North Carolina contractor from another company's Stripe. If Connect Stripe opened the wrong company, the contractor payout key for this area was missing.",
  },
  {
    title: "How to read payment audit",
    screen: "Payment Audit",
    keywords: "paid unpaid invoice bride balance collected",
    steps: "Payment Audit is this area's bride payments. Paid means the money is recorded on the wedding. If a bride paid in Ovanta but the audit still says unpaid, the invoice was not matched to this wedding yet. The bride portal balance uses that same paid amount.",
  },
  {
    title: "How the P&L ledger works",
    screen: "P&L Ledger",
    keywords: "accounting profit loss ledger",
    steps: "P&L Ledger is the books for the area selected in the header. It does not combine companies. Switch areas in the header to see the other company.",
  },
  {
    title: "How tax reporting works",
    screen: "Tax Reporting",
    keywords: "1099 taxes contractor earnings",
    steps: "Tax Reporting is for contractors in this area. A contractor needs a signed W-9 on their profile before they are paid. The W-9 is completed by the contractor, under Documents on their profile.",
  },
  {
    title: "How to set the company name, logo, and app link",
    screen: "Settings",
    keywords: "branding logo company name public app url settings",
    steps: "Select the area in the header first. Then open Settings, Branding. The company name and logo are what proposals, contracts, and the contractor sidebar use. The Public App URL is per area. Type it and save branding. North Carolina and Tennessee do not share one link.",
  },
  {
    title: "How to connect Ovanta",
    screen: "Settings",
    keywords: "ovanta ghl integration api key test connection sms email",
    steps: "Select the area, then Settings, Integrations. Test Connection should name the company and the area, not only a long id. Texts, tags, and new applicants use that area's connection. The key is not in the browser.",
  },
  {
    title: "How to set the contractor Stripe key",
    screen: "Settings",
    keywords: "contractor payout stripe secret connect stripe captured memories honeysuckle",
    steps: "Select the area, then Settings, Contractor Payout Stripe Secret. Paste that company's Stripe secret and save. Contractors in that area then connect from their profile, and the Stripe page is that company. A new area does not fall back to Honeysuckle. Until the key is saved, Connect Stripe stops and says the area is not set up.",
  },
  {
    title: "How editor payouts work",
    screen: "Settings",
    keywords: "editor stripe invoice delivered songs",
    steps: "Editors use a separate key: Settings, Editor Payout Stripe Secret, for the selected area. An editor who works in two areas connects once per area. Delivered work that is not invoiced should show Send invoice. Paid, invoiced jobs can be archived off the active pipeline. The row shows the company name so a North Carolina film is not mistaken for the other company.",
  },
  {
    title: "How the area picker works",
    screen: "Header",
    keywords: "switch area north carolina tennessee home area",
    steps: "The area picker is in the header. It lists only the areas that person is assigned to. There is no All Areas total. Sign-in loads their home area. Change the picker before reading weddings, money, messages, or settings. The assistant answers for whichever area is selected.",
  },
  {
    title: "How royalties work",
    screen: "Royalty",
    keywords: "royalty franchise fee payback owner",
    steps: "Royalty is per area. An owner sees their own area. A person who can switch areas must select the company first. Marking a royalty paid should clear what is due. It should not leave a leftover negative that ignores the payment.",
  },
  {
    title: "How the bride portal works",
    screen: "Bride portal",
    keywords: "questionnaire timeline songs contract portal message invoice",
    steps: "The couple signs the contract and pays from the proposal link. That link is not the questionnaire. Their portal shows the package, the timeline, and any extra event dates. They fill the questionnaire in that portal. They can edit the timeline there without reopening the whole questionnaire. A message sent from the app also shows in the portal. Manage payment opens the invoice from checkout. The contract uses the area's company name from Settings, not the word Veydra.",
  },
  {
    title: "How to send the wedding questionnaire",
    screen: "Weddings",
    keywords: "questionnaire bride portal reminder welcome email send link",
    steps: "There is no separate send-questionnaire button. The questionnaire lives in the bride portal. Open the wedding, then Actions. Send Portal Reminder, then Email or SMS, sends her the portal link. Resend Confirmation sends the bride welcome email, which also has that link. The welcome email template has to be saved in Settings first. She opens the link, signs in to the portal, and fills the questionnaire. You can read and edit the same answers on the wedding under the Questionnaire tab. Do not send the proposal link for this. That link is only the contract and payment.",
  },
  {
    title: "How the wedding checklist works",
    screen: "Weddings",
    keywords: "checklist manager tasks publish questionnaire",
    steps: "Open the wedding. The checklist is the manager's list from publish through post-production. Some items check themselves when the work is done, such as a signed contract or a paid invoice. Others are marked by hand. A helper on an open item says where to finish it. The checklist does not send the questionnaire.",
  },
  {
    title: "Where the training videos are",
    screen: "Training",
    keywords: "training video how to learn tutorial",
    steps: "Open Training. The videos are: How to process a wedding post production, How to read the dashboard in Veydra, How to build a proposal in Veydra, Bartending Upsell Tutorial, and How to add an event to an existing wedding.",
  },
  {
    title: "How sales rep payout info works",
    screen: "Proposals",
    keywords: "salesperson venmo zelle commission rep",
    steps: "A salesperson is recorded by the name and email on the proposal. Their payout handle is saved once, on that email, and it stays for the next proposal. It can be a Venmo handle or a Zelle email. It does not create a separate login.",
  },
  {
    title: "How to sell bartending",
    screen: "Weddings",
    keywords: "bartender upsell bar service",
    steps: "Bartending is an add-on on a booked wedding, or its own event with its own date, pay, and contractor. The upsell sends its own invoice. Training video: Bartending Upsell Tutorial.",
  },
  {
    title: "What this assistant can answer",
    screen: "Area assistant",
    keywords: "help what can you do analytics sales",
    steps: "This assistant reads only the area selected in the header. It can explain the screens in these notes and it can count booked weddings, package value, collected money, what is still owed, and open jobs. Ask for this week or this month when you want a range. It cannot send a message, edit a wedding, or pay anyone.",
  },
];
