import { Navigate, useParams } from 'react-router-dom';
import { CampaignLanding } from '../components/CampaignLanding';
import { campaignCopy } from '../lib/campaignLandings';

export function CampaignLandingPage({ slug: slugProp }: { slug?: string }) {
  const params = useParams<{ slug?: string }>();
  const slug = slugProp || params.slug || '';
  const copy = campaignCopy(slug);
  if (!copy) return <Navigate to="/" replace />;
  return <CampaignLanding copy={copy} />;
}
