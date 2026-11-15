export const plans = { basic: { name:'Basic', price:2499 }, plus:{name:'Plus',price:3499} } as const;
export const extraTemplatePrice = 500;
export type Subscription = {
  plan: keyof typeof plans;
  included_template: string;
  expires_at: string;
};
export const formatPlanEnd=(iso:string)=>new Intl.DateTimeFormat('en-PK',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Karachi'}).format(new Date(iso))+' PKT';
