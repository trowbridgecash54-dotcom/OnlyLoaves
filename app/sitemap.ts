import type { MetadataRoute } from "next";
import { routes, siteUrl } from "@/lib/site";
import { getSite } from "@/lib/site-data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { plan } = await getSite();
  const paths: string[] = [
    routes.home,
    routes.bread,
    routes.order,
    routes.story,
    routes.howToOrder,
    routes.contact,
    routes.privacy,
  ];
  if (plan) paths.push(routes.club, routes.clubJoin);

  return paths.map((path) => ({
    url: `${siteUrl()}${path === "/" ? "" : path}`,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
