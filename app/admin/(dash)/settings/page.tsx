import Link from "next/link";
import { PhotoField } from "@/components/admin/client";
import { AdminPage, Area, Field, PostForm, Save, Section, Tick, adminLink, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { photoUrl } from "@/lib/images";

export default async function SettingsPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const { site } = await loadOwnerView(store);
  const { business, copy, story } = site;

  return (
    <AdminPage
      title="Settings"
      intro="Wording, contact details and photos used across the website."
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
    >
      <nav aria-label="On this page" className="mb-4 flex flex-wrap gap-x-6 gap-y-1">
        <a href="#business" className={adminLink}>Business details</a>
        <a href="#wording" className={adminLink}>Wording and photos</a>
        <a href="#story" className={adminLink}>Our Story</a>
      </nav>

      <Section id="business" title="Business details">
        <PostForm action="business-save" back="/admin/settings" className="grid max-w-[48rem] gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 border-l-2 border-terracotta bg-paper px-4 py-3">
            <Tick
              label="Open ordering to the public"
              name="ordersOpen"
              defaultChecked={business.ordersOpen}
              hint="While off, customers can browse but the order and Club forms are closed. Turn on only once your permit and the launch checklist are done."
            />
          </div>
          <Field label="Business name" name="name" required defaultValue={business.name} />
          <Field label="Public contact email" name="email" type="email" defaultValue={business.email} hint="Optional. Leave blank to hide it — customers can still use the contact form." />
          <div className="sm:col-span-2"><Field label="Instagram link" name="instagramUrl" type="url" defaultValue={business.instagramUrl} hint="Full link, e.g. https://www.instagram.com/yourname. Blank hides Instagram." /></div>
          <div className="sm:col-span-2"><Area label="Short description" name="tagline" defaultValue={business.tagline} rows={2} hint="Used in the footer and in search results." /></div>
          <div className="sm:col-span-2"><Field label="Announcement banner" name="announcement" defaultValue={business.announcement} hint="A notice at the top of every page, e.g. “No bake the week of December 22.” Blank hides it." /></div>
          <div className="sm:col-span-2"><Area label="Required disclosures" name="disclosures" defaultValue={business.disclosures.join("\n")} hint="One per line, shown in the footer. Use the exact wording your permit requires — add it only once it's confirmed." /></div>
          <div className="sm:col-span-2"><Save>Save business details</Save></div>
        </PostForm>
      </Section>

      <Section id="wording" title="Wording and photos" description="In Club wording you can write {price}, {loaves}, {LoavesWord} and {interval}; the site fills in the current plan.">
        <PostForm action="copy-save" back="/admin/settings" upload className="grid max-w-[48rem] gap-5 sm:grid-cols-2">
          <Field label="Homepage headline, line 1" name="heroLine1" defaultValue={copy.heroLine1} />
          <Field label="Homepage headline, line 2" name="heroLine2" defaultValue={copy.heroLine2} />
          <div className="sm:col-span-2"><Area label="Homepage introduction" name="heroSupporting" defaultValue={copy.heroSupporting} rows={2} /></div>
          <div className="sm:col-span-2"><PhotoField name="hero_photo" label="Homepage photo" current={copy.heroImage ? photoUrl(copy.heroImage) : null} hint="A tall photo works best." /></div>
          <Field label="Bread section heading" name="featuredHeading" defaultValue={copy.featuredHeading} />
          <Field label="Club section heading" name="clubHeading" defaultValue={copy.clubHeading} />
          <div className="sm:col-span-2"><Area label="Club section text" name="clubSupporting" defaultValue={copy.clubSupporting} rows={2} /></div>
          <Field label="Club section small line" name="clubAside" defaultValue={copy.clubAside} />
          <Field label="Club page headline" name="clubPageHeadline" defaultValue={copy.clubPageHeadline} />
          <div className="sm:col-span-2"><Area label="Club page introduction" name="clubPageSupporting" defaultValue={copy.clubPageSupporting} rows={2} /></div>
          <div className="sm:col-span-2"><Field label="Club page small line" name="clubPageAside" defaultValue={copy.clubPageAside} /></div>
          <div className="sm:col-span-2"><PhotoField name="club_photo" label="Club photo" current={copy.clubImage ? photoUrl(copy.clubImage) : null} hint="A wide photo of several loaves works best." /></div>
          <div className="sm:col-span-2"><Save>Save wording and photos</Save></div>
        </PostForm>
      </Section>

      <Section id="story" title="Our Story" description="Write in your own words. Anything left blank shows “We're still writing this part.”">
        <PostForm action="story-save" back="/admin/settings" upload className="grid max-w-[48rem] gap-5">
          <Area label="Introduction" name="intro" defaultValue={story.intro} hint="A few sentences. Also shown on the homepage." />
          <Area label="How OnlyLoafs started" name="howItStarted" defaultValue={story.howItStarted} rows={4} />
          <Area label="Why you bake" name="whyBaking" defaultValue={story.whyBaking} rows={4} />
          <Area label="How the bread is made" name="process" defaultValue={story.process} rows={4} />
          <Area label="Why customers choose OnlyLoafs" name="whyUs" defaultValue={story.whyUs} rows={4} />
          <Field label="Baker's name (optional)" name="bakerName" defaultValue={story.bakerName} />
          <PhotoField name="photo" label="Photo of the baker" current={story.image ? photoUrl(story.image) : null} />
          <Save>Save Our Story</Save>
        </PostForm>
      </Section>
      <p className="type-small"><Link href="/" className={adminLink}>See the website</Link></p>
    </AdminPage>
  );
}
