import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  Copy, Check, Palette, Upload, Mail, Phone, Globe,
  Sparkles, X,
  Download, CalendarDays, Loader2, ChevronLeft, ChevronRight,
  BookOpen,
} from 'lucide-react';
import { ColorSwatchRow } from '../components/ColorSwatchRow';
import linkedInBluePng from '../assets/social-icons/LI-In-Bug.png';

// CDN icon URLs — reliable in both browser preview and email clients
const iconLinkedIn  = linkedInBluePng;
const iconX         = 'https://cdn.simpleicons.org/x/000000';
const iconFacebook  = 'https://cdn.simpleicons.org/facebook/1877F2';
const iconInstagram = 'https://cdn.simpleicons.org/instagram/E4405F';
const iconYouTube   = 'https://cdn.simpleicons.org/youtube/FF0000';
const iconPinterest = 'https://cdn.simpleicons.org/pinterest/E60023';
const iconTikTok    = 'https://cdn.simpleicons.org/tiktok/000000';
const iconThreads   = 'https://cdn.simpleicons.org/threads/000000';
const iconWhatsApp  = 'https://cdn.simpleicons.org/whatsapp/25D366';
const iconTelegram  = 'https://cdn.simpleicons.org/telegram/26A5E4';
const iconDiscord   = 'https://cdn.simpleicons.org/discord/5865F2';

type StyleKey = 'modern' | 'classic' | 'minimal' | 'portrait' | 'banner' | 'executive' | 'divider' | 'agency' | 'creative';
type LogoPosition = 'top-left' | 'top-right' | 'inline';

interface SigData {
  fullName: string; title: string; company: string; email: string;
  phone: string; website: string; address: string; logoUrl: string;
  accentColor: string; bookingUrl: string;
  linkedin: string; twitter: string; facebook: string; instagram: string;
  youtube: string; tiktok: string; threads: string; whatsapp: string;
  telegram: string; discord: string; pinterest: string;
}

// Map each social key to its icon asset
const SOCIAL_ICONS: Record<string, string> = {
  linkedin:  iconLinkedIn,
  twitter:   iconX,
  facebook:  iconFacebook,
  instagram: iconInstagram,
  youtube:   iconYouTube,
  tiktok:    iconTikTok,
  threads:   iconThreads,
  whatsapp:  iconWhatsApp,
  telegram:  iconTelegram,
  discord:   iconDiscord,
  pinterest: iconPinterest,
};

const SOCIAL_KEYS = ['linkedin','twitter','facebook','instagram','youtube','tiktok','threads','whatsapp','telegram','discord','pinterest'] as const;
type SocialKey = typeof SOCIAL_KEYS[number];

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function hexToRgb(hex: string) {
  const c = hex.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}
function lightenHex(hex: string, f: number): string {
  const c = hex.replace('#','');
  const r = Math.min(255,Math.round(parseInt(c.slice(0,2),16)+(255-parseInt(c.slice(0,2),16))*f));
  const g = Math.min(255,Math.round(parseInt(c.slice(2,4),16)+(255-parseInt(c.slice(2,4),16))*f));
  const b = Math.min(255,Math.round(parseInt(c.slice(4,6),16)+(255-parseInt(c.slice(4,6),16))*f));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function logoImg(url: string, alt: string, w: number, _pos: LogoPosition, _accent: string): string {
  return `<img src="${esc(url)}" alt="${esc(alt||'Logo')}" width="${w}" style="display:block;width:${w}px;height:auto;max-height:${w}px;margin-bottom:8px;border-radius:4px;" />`;
}

// Build social icons row HTML using PNG icons
function buildSocialIconsHtml(d: SigData, size = 24): string {
  const items: {url:string;icon:string;label:string}[] = [];
  if(d.linkedin)  items.push({url:d.linkedin,  icon:SOCIAL_ICONS.linkedin,  label:'LinkedIn'});
  if(d.twitter)   items.push({url:d.twitter,   icon:SOCIAL_ICONS.twitter,   label:'X'});
  if(d.facebook)  items.push({url:d.facebook,  icon:SOCIAL_ICONS.facebook,  label:'Facebook'});
  if(d.instagram) items.push({url:d.instagram, icon:SOCIAL_ICONS.instagram, label:'Instagram'});
  if(d.youtube)   items.push({url:d.youtube,   icon:SOCIAL_ICONS.youtube,   label:'YouTube'});
  if(d.tiktok)    items.push({url:d.tiktok,    icon:SOCIAL_ICONS.tiktok,    label:'TikTok'});
  if(d.threads)   items.push({url:d.threads,   icon:SOCIAL_ICONS.threads,   label:'Threads'});
  if(d.whatsapp)  items.push({url:d.whatsapp,  icon:SOCIAL_ICONS.whatsapp,  label:'WhatsApp'});
  if(d.telegram)  items.push({url:d.telegram,  icon:SOCIAL_ICONS.telegram,  label:'Telegram'});
  if(d.discord)   items.push({url:d.discord,   icon:SOCIAL_ICONS.discord,   label:'Discord'});
  if(d.pinterest) items.push({url:d.pinterest, icon:SOCIAL_ICONS.pinterest, label:'Pinterest'});
  if(!items.length) return '';
  return items.map(i=>`<a href="${esc(i.url)}" style="display:inline-block;margin-right:8px;vertical-align:middle;text-decoration:none;" title="${esc(i.label)}"><img src="${esc(i.icon)}" alt="${esc(i.label)}" width="${size}" height="${size}" style="display:inline-block;width:${size}px;height:${size}px;border-radius:4px;" /></a>`).join('');
}

function renderModern(d: SigData, logoW = 60, logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const hb = d.bookingUrl.trim()!=='';
  const logoHtml = d.logoUrl ? logoImg(d.logoUrl, d.company, logoW, logoPos, a) : '';
  const ci: string[] = [];
  if(d.email) ci.push(`<p style="margin:0 0 2px 0;white-space:nowrap;color:#6b7280;font-size:12px;font-family:Arial,Helvetica,sans-serif;">${esc(d.email)}</p>`);
  if(d.phone) ci.push(`<p style="margin:0 0 2px 0;white-space:nowrap;color:#6b7280;font-size:12px;font-family:Arial,Helvetica,sans-serif;">${esc(d.phone)}</p>`);
  if(d.website) ci.push(`<p style="margin:0;white-space:nowrap;font-size:12px;font-family:Arial,Helvetica,sans-serif;"><a href="${esc(d.website)}" style="color:${a};text-decoration:none;">${esc(d.website.replace(/^https?:\/\//,''))}</a></p>`);
  const nameBlock = logoPos === 'inline' && d.logoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;"><tr><td style="vertical-align:middle;padding-right:10px;">${logoHtml}</td><td style="vertical-align:middle;"><p style="margin:0 0 2px 0;font-size:15px;font-weight:700;color:#111827;line-height:1.2;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${esc(d.fullName||'Your Name')}</p>${d.title||d.company?`<p style="margin:0;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc([d.title,d.company].filter(Boolean).join(' · '))}</p>`:''}</td></tr></table>`
    : `${logoPos !== 'top-right' ? logoHtml : ''}<p style="margin:0 0 2px 0;font-size:15px;font-weight:700;color:#111827;line-height:1.2;font-family:Arial,Helvetica,sans-serif;">${esc(d.fullName||'Your Name')}</p>${d.title||d.company?`<p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc([d.title,d.company].filter(Boolean).join(' · '))}</p>`:`<div style="height:8px;"></div>`}`;
  const rightLogo = (logoPos === 'top-right' && d.logoUrl) ? `<td style="padding:16px 18px 16px 8px;vertical-align:middle;">${logoHtml}</td>` : '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:480px;max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td style="width:4px;background:${a};padding:0;"></td><td style="padding:16px 14px 16px 16px;vertical-align:middle;">${nameBlock}${ci.join('')}</td>${hb?`<td style="padding:16px 18px 16px 8px;vertical-align:middle;white-space:nowrap;"><a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;padding:8px 16px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;">&#128197; Schedule a meeting</a></td>`:''}${rightLogo}</tr></table>`;
}

function renderClassic(d: SigData, logoW = 60, logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const rgb = hexToRgb(a); const hb = d.bookingUrl.trim()!=='';
  const fp: string[] = [];
  if(d.email) fp.push(`<td style="padding:0 20px 0 0;white-space:nowrap;font-size:11px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${esc(d.email)}</td>`);
  if(d.phone) fp.push(`<td style="padding:0 20px 0 0;white-space:nowrap;font-size:11px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${esc(d.phone)}</td>`);
  if(d.website) fp.push(`<td style="padding:0 20px 0 0;white-space:nowrap;font-size:11px;font-family:Arial,Helvetica,sans-serif;"><a href="${esc(d.website)}" style="color:#ffffff;text-decoration:none;">${esc(d.website.replace(/^https?:\/\//,''))}</a></td>`);
  if(hb) fp.push(`<td style="white-space:nowrap;font-size:11px;font-family:Arial,Helvetica,sans-serif;"><a href="${esc(d.bookingUrl)}" style="color:#ffffff;font-weight:700;text-decoration:none;">&#128197; Book a meeting</a></td>`);
  const lHtml = d.logoUrl ? logoImg(d.logoUrl, d.company, logoW, logoPos, a) : '';
  const nameCol = logoPos === 'inline' && d.logoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;"><tr><td style="vertical-align:middle;padding-right:10px;">${lHtml}</td><td style="vertical-align:middle;"><p style="margin:0 0 2px 0;font-size:16px;font-weight:800;color:${a};line-height:1.15;font-family:Arial,Helvetica,sans-serif;">${esc(d.fullName||'Your Name')}</p>${d.title||d.company?`<p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc([d.title,d.company].filter(Boolean).join(' · '))}</p>`:''}</td></tr></table>`
    : `${logoPos !== 'top-right' ? lHtml : ''}<p style="margin:0 0 2px 0;font-size:16px;font-weight:800;color:${a};line-height:1.15;font-family:Arial,Helvetica,sans-serif;">${esc(d.fullName||'Your Name')}</p>${d.title||d.company?`<p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc([d.title,d.company].filter(Boolean).join(' · '))}</p>`:''}`;
  const rightLogo = logoPos === 'top-right' && d.logoUrl ? `<td style="padding:18px 16px 18px 0;vertical-align:middle;">${lHtml}</td>` : '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:480px;max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td valign="middle" style="padding:18px 16px;width:55%;border-right:1px solid #f3f4f6;">${nameCol}</td><td valign="middle" style="padding:18px 18px;"><table cellpadding="0" cellspacing="0" border="0">${d.email?`<tr><td style="padding:2px 8px 2px 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">Email</td><td style="padding:2px 0;font-size:12px;color:#374151;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${esc(d.email)}</td></tr>`:''}${d.phone?`<tr><td style="padding:2px 8px 2px 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">Phone</td><td style="padding:2px 0;font-size:12px;color:#374151;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${esc(d.phone)}</td></tr>`:''}${d.website?`<tr><td style="padding:2px 8px 2px 0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">Web</td><td style="padding:2px 0;font-size:12px;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;"><a href="${esc(d.website)}" style="color:${a};text-decoration:none;">${esc(d.website.replace(/^https?:\/\//,''))}</a></td></tr>`:''}${hb?`<tr><td colspan="2" style="padding-top:10px;"><a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:6px 14px;border-radius:5px;font-family:Arial,Helvetica,sans-serif;">&#128197; Schedule a meeting</a></td></tr>`:''}</table></td>${rightLogo}</tr>${fp.length?`<tr><td colspan="${rightLogo?3:2}" style="background:linear-gradient(90deg,${a} 0%,rgba(${rgb},0.75) 100%);padding:9px 18px;border-radius:0 0 7px 7px;"><table cellpadding="0" cellspacing="0" border="0"><tr>${fp.join('')}</tr></table></td></tr>`:''}</table>`;
}

function renderMinimal(d: SigData, logoW = 60, _logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const rgb = hexToRgb(a); const hb = d.bookingUrl.trim()!=='';
  const np = d.fullName.trim().split(/\s+/).filter(Boolean);
  const i1 = (np[0]?.[0]??'A').toUpperCase(); const i2 = (np.length>=2?np[np.length-1][0]:np[0]?.[1]??'B').toUpperCase();
  const sz = Math.min(logoW, 60);
  const mono = d.logoUrl?`<img src="${esc(d.logoUrl)}" alt="Logo" width="${sz}" height="${sz}" style="width:${sz}px;height:${sz}px;border-radius:50%;object-fit:cover;display:block;" />`:`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(${rgb},0.12);border:1.5px solid rgba(${rgb},0.3);font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:16px;color:${a};text-align:center;line-height:${sz}px;">${i1}${i2}</div>`;
  const cr: string[] = [];
  if(d.email) cr.push(`<tr><td style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;padding:3px 10px 3px 0;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">EMAIL</td><td style="width:1px;padding:3px 10px;vertical-align:middle;"><div style="width:1px;height:14px;border-left:1.5px dashed #d1d5db;"></div></td><td style="font-size:12px;color:#374151;padding:3px 0;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">${esc(d.email)}</td></tr>`);
  if(d.phone) cr.push(`<tr><td style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;padding:3px 10px 3px 0;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">MOBILE</td><td style="width:1px;padding:3px 10px;vertical-align:middle;"><div style="width:1px;height:14px;border-left:1.5px dashed #d1d5db;"></div></td><td style="font-size:12px;color:#374151;padding:3px 0;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">${esc(d.phone)}</td></tr>`);
  if(d.website) cr.push(`<tr><td style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;padding:3px 10px 3px 0;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">WEB</td><td style="width:1px;padding:3px 10px;vertical-align:middle;"><div style="width:1px;height:14px;border-left:1.5px dashed #d1d5db;"></div></td><td style="font-size:12px;color:#374151;padding:3px 0;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;"><a href="${esc(d.website)}" style="color:${a};text-decoration:none;">${esc(d.website.replace(/^https?:\/\//,''))}</a></td></tr>`);
  if(hb) cr.push(`<tr><td colspan="3" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;"><a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:6px 14px;border-radius:5px;">&#128197; Schedule a meeting</a></td></tr>`);
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:480px;max-width:480px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td valign="middle" align="center" style="padding:18px 14px 18px 18px;width:70px;">${mono}</td><td valign="middle" style="padding:18px 12px;border-right:1.5px dashed #d1d5db;white-space:nowrap;"><p style="margin:0 0 2px 0;font-size:14px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;">${esc(d.fullName||'Your Name')}</p>${d.title?`<p style="margin:0 0 1px 0;font-size:11px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc(d.title)}</p>`:''}${d.company?`<p style="margin:0;font-size:11px;color:${a};font-weight:600;font-family:Arial,Helvetica,sans-serif;">${esc(d.company)}</p>`:''}</td><td valign="middle" style="padding:18px 18px;">${cr.length?`<table cellpadding="0" cellspacing="0" border="0">${cr.join('')}</table>`:''}</td></tr><tr><td colspan="3" style="padding:0;height:4px;background:linear-gradient(90deg,${a} 0%,rgba(${rgb},0.2) 100%);"></td></tr></table>`;
}

function renderPortrait(d: SigData, logoW = 80, _logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const rgb = hexToRgb(a); const hb = d.bookingUrl.trim()!=='';
  const np = d.fullName.trim().split(/\s+/).filter(Boolean);
  const initials = ((np[0]?.[0]??'A')+(np[1]?.[0]??'B')).toUpperCase();
  const sz = Math.max(40, Math.min(logoW, 120));
  const photo = d.logoUrl?`<img src="${esc(d.logoUrl)}" width="${sz}" height="${sz}" alt="${esc(d.fullName)}" style="width:${sz}px;height:${sz}px;border-radius:50%;object-fit:cover;display:block;border:3px solid ${a};" />`:`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(${rgb},0.1);border:3px solid ${a};font-family:Georgia,serif;font-size:24px;font-weight:700;color:${a};text-align:center;line-height:${sz}px;">${initials}</div>`;
  const socialHtml = buildSocialIconsHtml(d, 24);
  const contactLines = [d.phone,d.email].filter(Boolean).map(v=>`<p style="margin:0 0 2px 0;white-space:nowrap;font-size:12px;color:#374151;font-family:Arial,Helvetica,sans-serif;font-weight:500;">${esc(v)}</p>`).join('');
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:360px;max-width:360px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;"><tr><td align="center" style="padding:28px 24px 0 24px;">${photo}<p style="margin:14px 0 4px 0;font-size:22px;font-weight:700;color:${a};font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.3px;">${esc(d.fullName||'Your Name')}</p>${d.title?`<p style="margin:0 0 2px 0;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc(d.title)}${d.company?` — ${esc(d.company)}`:''}</p>`:''}<div style="width:80%;height:1px;background:#e5e7eb;margin:14px auto;"></div>${d.address?`<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc(d.address)}</p>`:''}${contactLines}${socialHtml?`<div style="margin:12px 0 6px 0;">${socialHtml}</div>`:''}${hb?`<div style="margin:10px 0 20px 0;"><a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#fff;text-decoration:none;font-size:11px;font-weight:600;padding:7px 20px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;">&#128197; Schedule a meeting</a></div>`:`<div style="height:20px;"></div>`}</td></tr></table>`;
}

function renderBanner(d: SigData, logoW = 60, _logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const lightBg = lightenHex(a,0.88); const hb = d.bookingUrl.trim()!=='';
  const socialHtml = buildSocialIconsHtml(d, 24);
  const parts = (d.company||'').split(/\s+/);
  const compHtml = parts.length>=2?`<span style="font-weight:900;color:#ffffff;">${esc(parts[0])}</span><span style="font-weight:400;color:#ffffff;">${esc(parts.slice(1).join(' '))}</span>`:`<span style="font-weight:700;color:#ffffff;">${esc(d.company||'')}</span>`;
  const bLogoHtml = d.logoUrl?`<img src="${esc(d.logoUrl)}" alt="${esc(d.company||'Logo')}" style="display:block;width:${Math.min(logoW,90)}px;height:auto;max-height:60px;margin:0 auto 10px auto;" />`:`<div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.2);margin:0 auto 10px auto;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#ffffff;text-align:center;line-height:52px;">${(d.company||d.fullName||'CO')[0].toUpperCase()}</div>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:520px;max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td valign="middle" align="center" style="width:150px;background:${a};padding:20px 16px;">${bLogoHtml}${d.company?`<p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.5px;text-align:center;font-family:Arial,Helvetica,sans-serif;">${compHtml}</p>`:''}${socialHtml?`<div style="text-align:center;">${socialHtml}</div>`:''}</td><td valign="middle" style="padding:20px 24px;"><p style="margin:0 0 1px 0;font-size:16px;font-weight:700;color:#111827;font-family:Arial,Helvetica,sans-serif;">${esc(d.fullName||'Your Name')}</p>${d.title?`<p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc(d.title)}</p>`:`<div style="height:12px;"></div>`}${d.address?`<p style="margin:0 0 2px 0;font-size:12px;color:#374151;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;font-weight:600;">${esc(d.address)}</p>`:''}${d.phone?`<p style="margin:0 0 2px 0;font-size:12px;color:#374151;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">Call : ${esc(d.phone)}</p>`:''}${d.email?`<p style="margin:0 0 10px 0;font-size:12px;color:#374151;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${esc(d.email)}</p>`:''}${d.website?`<p style="margin:0 0 8px 0;font-size:11px;font-family:Arial,Helvetica,sans-serif;"><a href="${esc(d.website)}" style="color:${a};text-decoration:none;">${esc(d.website.replace(/^https?:\/\//,''))}</a></p>`:''}${hb?`<a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${lightBg};color:${a};text-decoration:none;font-size:11px;font-weight:700;padding:6px 14px;border-radius:5px;border:1px solid ${a};font-family:Arial,Helvetica,sans-serif;">&#128197; Schedule a meeting</a>`:''}</td></tr></table>`;
}

function renderExecutive(d: SigData, logoW = 60, logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const hb = d.bookingUrl.trim()!=='';
  const socialHtml = buildSocialIconsHtml(d, 20);
  const ic: string[] = [];
  if(d.phone) ic.push(`<tr><td style="padding:2px 0;white-space:nowrap;font-size:12px;color:#374151;font-family:Arial,Helvetica,sans-serif;"><span style="color:#9ca3af;font-weight:700;">T :</span> ${esc(d.phone)}</td></tr>`);
  if(d.email) ic.push(`<tr><td style="padding:2px 0;white-space:nowrap;font-size:12px;color:#374151;font-family:Arial,Helvetica,sans-serif;"><span style="color:#9ca3af;font-weight:700;">E :</span> ${esc(d.email)}</td></tr>`);
  if(d.website) ic.push(`<tr><td style="padding:2px 0;white-space:nowrap;font-size:12px;font-family:Arial,Helvetica,sans-serif;"><a href="${esc(d.website)}" style="color:${a};text-decoration:none;font-weight:600;">${esc(d.website.replace(/^https?:\/\//,''))}</a></td></tr>`);
  const lHtml = d.logoUrl ? logoImg(d.logoUrl, 'Logo', logoW, logoPos, a) : '';
  const logoTopLeft = (logoPos === 'top-left' || logoPos === 'inline') ? lHtml : '';
  const logoTopRight = logoPos === 'top-right' ? `<td align="right" style="padding-bottom:8px;vertical-align:bottom;">${lHtml}</td>` : '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:500px;max-width:500px;background:#ffffff;"><tr><td style="padding:16px 0 6px 0;"><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td>${logoTopLeft}<p style="margin:0;font-size:28px;font-weight:900;color:#111827;letter-spacing:-1px;text-transform:uppercase;line-height:1;font-family:Arial,Helvetica,sans-serif;">${esc(d.fullName||'YOUR NAME')}</p></td>${logoTopRight}</tr></table></td></tr><tr><td style="padding:6px 0;"><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:#f3f4f6;padding:7px 12px;border-radius:3px;"><span style="font-size:12px;font-weight:700;color:#374151;font-family:Arial,Helvetica,sans-serif;">${esc([d.title,d.company].filter(Boolean).join(' · ')||'Title · Company')}</span></td>${socialHtml?`<td align="right" style="padding-left:12px;white-space:nowrap;">${socialHtml}</td>`:''}</tr></table></td></tr>${d.address?`<tr><td style="padding:6px 0 2px 0;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc(d.address)}</td></tr>`:''}${ic.length?`<tr><td style="padding:4px 0;"><table cellpadding="0" cellspacing="0" border="0">${ic.join('')}</table></td></tr>`:''}${hb?`<tr><td style="padding-top:10px;"><a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:6px 16px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;">&#128197; Schedule a meeting</a></td></tr>`:''}<tr><td style="height:3px;background:${a};border-radius:1px;padding:0;"></td></tr></table>`;
}

function renderDivider(d: SigData, logoW = 60, _logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const hb = d.bookingUrl.trim()!=='';
  const np = d.fullName.trim().split(/\s+/).filter(Boolean);
  const initials = ((np[0]?.[0]??'A')+(np[1]?.[0]??'B')).toUpperCase();
  const dLogo = d.logoUrl?`<img src="${esc(d.logoUrl)}" alt="${esc(d.company||'Logo')}" style="display:block;width:${Math.min(logoW,110)}px;height:auto;max-height:80px;margin:0 auto 10px auto;" />`:`<div style="width:72px;height:72px;border-radius:50%;border:2px solid ${a};background:#ffffff;font-family:Georgia,serif;font-size:20px;font-weight:700;color:${a};text-align:center;line-height:72px;margin:0 auto 10px auto;">${initials}</div>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:540px;max-width:540px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td valign="middle" align="center" style="width:160px;padding:24px 20px;background:#fafafa;">${dLogo}${d.company?`<p style="margin:0;font-size:12px;color:#374151;text-align:center;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;"><strong>${esc(d.company.split(' ')[0])}</strong>${d.company.split(' ').length>1?`<br/><span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">${esc(d.company.split(' ').slice(1).join(' '))}</span>`:''}  </p>`:''}</td><td style="width:1px;padding:16px 0;"><div style="width:1px;min-height:100px;border-left:1px solid #d1d5db;"></div></td><td valign="middle" style="padding:24px 26px;"><p style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#374151;letter-spacing:-0.3px;font-family:Georgia,'Times New Roman',serif;">${esc(d.fullName||'Your Name')}${d.title?`<span style="font-size:14px;font-weight:400;color:#6b7280;">, ${esc(d.title)}</span>`:''}</p>${d.address?`<p style="margin:0 0 2px 0;font-size:12px;color:#6b7280;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${esc(d.address)}</p>`:''}${d.phone?`<p style="margin:0 0 2px 0;font-size:12px;color:#6b7280;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${esc(d.phone)} phone</p>`:''}${d.email?`<p style="margin:0 0 2px 0;font-size:12px;color:#6b7280;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${esc(d.email)}</p>`:''}${d.website?`<p style="margin:8px 0 0 0;"><a href="${esc(d.website)}" style="font-size:14px;font-weight:700;color:${a};text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${esc(d.website.replace(/^https?:\/\//,''))}</a></p>`:''}${hb?`<p style="margin:10px 0 0 0;"><a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:6px 14px;border-radius:5px;font-family:Arial,Helvetica,sans-serif;">&#128197; Schedule a meeting</a></p>`:''}</td></tr></table>`;
}

function renderAgency(d: SigData, logoW = 60, _logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const hb = d.bookingUrl.trim()!=='';
  const socialHtml = buildSocialIconsHtml(d, 24);
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:520px;max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;"><tr><td valign="middle" style="width:130px;padding:18px 16px 18px 18px;">${d.logoUrl?`<img src="${esc(d.logoUrl)}" alt="${esc(d.company||'Logo')}" style="width:${Math.min(logoW,100)}px;height:auto;max-height:52px;display:block;margin-bottom:6px;" />`:''} ${d.company?`<p style="margin:0;font-size:11px;font-weight:700;color:#111827;font-family:Arial,Helvetica,sans-serif;">${esc(d.company)}</p>`:''}</td><td style="width:3px;padding:0;background:${a};"></td><td valign="middle" style="padding:18px 22px;"><p style="margin:0 0 8px 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;"><span style="font-weight:800;color:${a};">${esc(d.fullName||'Your Name')}</span>${d.title?`<span style="font-weight:400;color:#374151;font-size:13px;"> ${esc(d.title)}</span>`:''}</p><table cellpadding="0" cellspacing="0" border="0">${d.email?`<tr><td style="padding:1px 6px 1px 0;font-size:11px;font-weight:700;color:${a};font-family:Arial,Helvetica,sans-serif;white-space:nowrap;vertical-align:middle;">e.</td><td style="padding:1px 16px 1px 0;font-size:12px;color:#374151;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">${esc(d.email)}</td>${d.website?`<td style="padding:1px 6px 1px 0;font-size:11px;font-weight:700;color:${a};font-family:Arial,Helvetica,sans-serif;white-space:nowrap;vertical-align:middle;">w.</td><td style="padding:1px 0;font-size:12px;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;"><a href="${esc(d.website)}" style="color:#374151;text-decoration:none;">${esc(d.website.replace(/^https?:\/\//,''))}</a></td>`:''}</tr>`:''}${d.address?`<tr><td style="padding:1px 6px 1px 0;font-size:11px;font-weight:700;color:${a};font-family:Arial,Helvetica,sans-serif;white-space:nowrap;vertical-align:middle;">a.</td><td colspan="3" style="padding:1px 0;font-size:12px;color:#374151;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">${esc(d.address)}</td></tr>`:''}${socialHtml||hb?`<tr><td colspan="4" style="padding-top:10px;">${socialHtml}${hb?`<a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;margin-left:6px;vertical-align:middle;">&#128197; Schedule</a>`:''}</td></tr>`:''}</table></td></tr></table>`;
}

function renderCreative(d: SigData, logoW = 60, logoPos: LogoPosition = 'top-left'): string {
  const a = d.accentColor||'#059669'; const lightBg = lightenHex(a,0.88); const rgb = hexToRgb(a); const hb = d.bookingUrl.trim()!=='';
  const socialHtml = buildSocialIconsHtml(d, 24);
  const wsStrip = d.website?`<a href="${esc(d.website)}" style="display:inline-block;background:${lightBg};color:${a};text-decoration:none;font-size:12px;font-weight:700;padding:5px 14px;border-radius:3px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;border:1px solid rgba(${rgb},0.2);">${esc(d.website.replace(/^https?:\/\//,'').toUpperCase())}</a>`:'';
  const contactLines = [d.email,d.phone].filter(Boolean).map(v=>`<p style="margin:0 0 2px 0;white-space:nowrap;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${esc(v)}</p>`).join('');
  const cLogo = d.logoUrl ? logoImg(d.logoUrl, 'Logo', logoW, logoPos, a) : '';
  const logoLeft = (logoPos === 'top-left' || logoPos === 'inline') ? cLogo : '';
  const logoRight = logoPos === 'top-right' ? cLogo : '';
  const nameBlock = logoPos === 'top-right' && d.logoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:6px;"><tr><td style="vertical-align:bottom;">${logoLeft}<p style="margin:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:900;color:#111827;text-transform:uppercase;letter-spacing:-0.5px;line-height:1;">${esc(d.fullName||'YOUR NAME')}${d.title?`<span style="font-size:13px;font-weight:400;color:#6b7280;text-transform:none;letter-spacing:0;"> (${esc(d.title)})</span>`:''}</p></td><td align="right" style="vertical-align:bottom;padding-left:12px;">${logoRight}</td></tr></table>`
    : `${logoLeft}<p style="margin:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:900;color:#111827;text-transform:uppercase;letter-spacing:-0.5px;line-height:1;">${esc(d.fullName||'YOUR NAME')}${d.title?`<span style="font-size:13px;font-weight:400;color:#6b7280;text-transform:none;letter-spacing:0;"> (${esc(d.title)})</span>`:''}</p>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;width:480px;max-width:480px;background:#ffffff;"><tr><td style="padding:0 0 10px 0;"><div style="width:40px;height:2px;background:#111827;margin-bottom:10px;border-radius:1px;"></div>${nameBlock}${contactLines}<table cellpadding="0" cellspacing="0" border="0"><tr>${socialHtml?`<td style="padding-right:8px;vertical-align:middle;">${socialHtml}</td>`:''} ${wsStrip?`<td style="vertical-align:middle;">${wsStrip}</td>`:''} ${hb?`<td style="padding-left:8px;vertical-align:middle;"><a href="${esc(d.bookingUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:5px 12px;border-radius:3px;font-family:Arial,Helvetica,sans-serif;">&#128197; Schedule</a></td>`:''}</tr></table></td></tr></table>`;
}

function renderPlainText(d: SigData): string {
  const lines: string[] = [];
  lines.push(d.fullName);
  if(d.title||d.company) lines.push([d.title,d.company].filter(Boolean).join(' | '));
  if(d.email) lines.push(d.email);
  if(d.phone) lines.push(d.phone);
  if(d.website) lines.push(d.website);
  if(d.address) lines.push(d.address);
  if(d.bookingUrl) lines.push(`Schedule a meeting: ${d.bookingUrl}`);
  if(d.linkedin)  lines.push(`LinkedIn: ${d.linkedin}`);
  if(d.twitter)   lines.push(`X: ${d.twitter}`);
  if(d.facebook)  lines.push(`Facebook: ${d.facebook}`);
  if(d.instagram) lines.push(`Instagram: ${d.instagram}`);
  if(d.youtube)   lines.push(`YouTube: ${d.youtube}`);
  return lines.join('\n');
}

const STYLES: {key:StyleKey;label:string;desc:string}[] = [
  {key:'modern',label:'Modern',desc:'Accent bar · CTA button'},
  {key:'classic',label:'Classic',desc:'Two-col · gradient footer'},
  {key:'minimal',label:'Minimal',desc:'Monogram · dashed dividers'},
  {key:'portrait',label:'Portrait',desc:'Centered photo · circles'},
  {key:'banner',label:'Banner',desc:'Colored panel · logo+socials'},
  {key:'executive',label:'Executive',desc:'Bold all-caps · inline links'},
  {key:'divider',label:'Divider',desc:'Logo · vertical line · serif'},
  {key:'agency',label:'Agency',desc:'e/w/a labels · square socials'},
  {key:'creative',label:'Creative',desc:'Rule · name · highlight strip'},
];

function CarouselPreview({htmlString}:{htmlString:string}) {
  const [scale,setScale] = useState(1);
  const [innerH,setInnerH] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const wrap=wrapRef.current; const inner=innerRef.current;
    if(!wrap||!inner) return;
    const update=()=>{ const s=Math.min(1,wrap.clientWidth/560); setScale(s); setInnerH(inner.scrollHeight); };
    update();
    const ro=new ResizeObserver(update); ro.observe(wrap);
    return ()=>ro.disconnect();
  },[htmlString]);

  return (
    <div ref={wrapRef} className="overflow-hidden w-full">
      <div
        ref={innerRef}
        dangerouslySetInnerHTML={{__html:htmlString}}
        className="[&_table]:border-collapse origin-top-left"
        style={{transform:`scale(${scale})`,transformOrigin:'top left',width:560,height:scale<1?`${innerH*scale}px`:undefined,pointerEvents:'none'}}
      />
    </div>
  );
}

const SOCIAL_INPUT_ROWS: {key: SocialKey; icon: string; label: string; placeholder: string}[] = [
  {key:'linkedin',  icon:iconLinkedIn,  label:'LinkedIn',  placeholder:'https://linkedin.com/in/yourname'},
  {key:'twitter',   icon:iconX,         label:'X / Twitter',placeholder:'https://x.com/yourhandle'},
  {key:'facebook',  icon:iconFacebook,  label:'Facebook',  placeholder:'https://facebook.com/yourpage'},
  {key:'instagram', icon:iconInstagram, label:'Instagram', placeholder:'https://instagram.com/yourhandle'},
  {key:'youtube',   icon:iconYouTube,   label:'YouTube',   placeholder:'https://youtube.com/@yourchannel'},
  {key:'tiktok',    icon:iconTikTok,    label:'TikTok',    placeholder:'https://tiktok.com/@yourhandle'},
  {key:'threads',   icon:iconThreads,   label:'Threads',   placeholder:'https://threads.net/@yourhandle'},
  {key:'whatsapp',  icon:iconWhatsApp,  label:'WhatsApp',  placeholder:'https://wa.me/15551234567'},
  {key:'telegram',  icon:iconTelegram,  label:'Telegram',  placeholder:'https://t.me/yourhandle'},
  {key:'discord',   icon:iconDiscord,   label:'Discord',   placeholder:'https://discord.gg/yourserver'},
  {key:'pinterest', icon:iconPinterest, label:'Pinterest', placeholder:'https://pinterest.com/yourprofile'},
];

export function EmailSignaturePage() {
  const {profile} = useAuth();
  const [style,setStyle] = useState<StyleKey>('modern');
  const styleIndex = STYLES.findIndex(s => s.key === style);
  const goPrev = () => { const i = (styleIndex - 1 + STYLES.length) % STYLES.length; setStyle(STYLES[i].key); };
  const goNext = () => { const i = (styleIndex + 1) % STYLES.length; setStyle(STYLES[i].key); };

  const [pageTab, setPageTab] = useState<'editor' | 'instructions'>('editor');
  const [copied,setCopied] = useState(false);
  const [uploadingLogo,setUploadingLogo] = useState(false);
  const [phoneError,setPhoneError] = useState('');
  const [websiteError,setWebsiteError] = useState('');
  const [logoW,setLogoW] = useState(60);
  const [logoPos,setLogoPos] = useState<LogoPosition>('top-left');
  const prefSaveTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const [isExample, setIsExample] = useState(false);

  const [data,setData] = useState<SigData>({
    fullName: 'Jon Doe Smith',
    title: 'Creative Director & Brand Strategist',
    company: 'Jon Doe Studio',
    email: 'jon.doesmith99@gmail.com',
    phone: '+1 (305) 555-0147',
    website: 'https://riveracreative.com',
    address: '2750 NW 3rd Ave, Miami, FL 33127',
    logoUrl: '',
    accentColor: '#5864C6',
    bookingUrl: `${window.location.origin}/jon-doe-smith`,
    linkedin:  'https://linkedin.com/in/jondoesmith',
    twitter:   'https://x.com/jondoesmith',
    facebook:  'https://facebook.com/jondoestudio',
    instagram: 'https://instagram.com/jondoe.creative',
    youtube:   'https://youtube.com/@jondoesmith',
    tiktok:    '',
    threads:   '',
    whatsapp:  '',
    telegram:  '',
    discord:   '',
    pinterest: '',
  });

  useEffect(()=>{
    if(!profile?.id) return;
    const origin = window.location.origin;
    supabase.from('signature_preferences')
      .select('logo_width,logo_position,sig_data,style')
      .eq('user_id',profile.id)
      .maybeSingle()
      .then(({data:pref})=>{
        if(pref?.logo_width) setLogoW(pref.logo_width);
        if(pref?.logo_position) setLogoPos(pref.logo_position as LogoPosition);
        if(pref?.style) setStyle(pref.style as StyleKey);
        if(pref?.sig_data) {
          const saved = pref.sig_data as Partial<SigData>;
          setData(prev=>({...prev,...saved}));
          setIsExample(false);
        } else {
          setData(prev=>({
            ...prev,
            fullName: profile.full_name || prev.fullName,
            email: profile.email || prev.email,
            bookingUrl: profile.slug ? `${origin}/${profile.slug}` : prev.bookingUrl,
          }));
          setIsExample(true);
        }
      });
  },[profile?.id]);

  const savePrefs = (lw:number,lp:LogoPosition)=>{
    if(!profile?.id) return;
    if(prefSaveTimer.current) clearTimeout(prefSaveTimer.current);
    prefSaveTimer.current = setTimeout(()=>{
      supabase.from('signature_preferences').upsert({user_id:profile.id,logo_width:lw,logo_position:lp,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    },800);
  };

  const saveData = ()=>{
    if(!profile?.id) return;
    supabase.from('signature_preferences').upsert({user_id:profile.id,sig_data:data,style,logo_width:logoW,logo_position:logoPos,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    setIsExample(false);
  };

  const handleLogoW = (v:number)=>{ setLogoW(v); savePrefs(v,logoPos); };
  const handleLogoPos = (v:LogoPosition)=>{ setLogoPos(v); savePrefs(logoW,v); };

  const logoInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof SigData>(k:K,v:SigData[K]) => setData(prev=>({...prev,[k]:v}));

  const validatePhone = (v:string)=>{if(!v){setPhoneError('');return;}const c=v.replace(/[\s\-().+]/g,'');if(!/^\d{7,15}$/.test(c))setPhoneError('Enter a valid phone number');else setPhoneError('');};
  const validateUrl = (v:string)=>{if(!v){setWebsiteError('');return;}try{new URL(v.startsWith('http')?v:`https://${v}`);setWebsiteError('');}catch{setWebsiteError('Enter a valid URL');}};

  const extractDominantColor = (img:HTMLImageElement):string => {
    try {
      const canvas = document.createElement('canvas'); canvas.width=50; canvas.height=50;
      const ctx = canvas.getContext('2d'); if(!ctx) return data.accentColor;
      ctx.drawImage(img,0,0,50,50);
      const px = ctx.getImageData(0,0,50,50).data;
      const counts:Record<string,number> = {};
      for(let i=0;i<px.length;i+=4){
        const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];
        if(a<128||r>230&&g>230&&b>230||r<25&&g<25&&b<25) continue;
        const k=`${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32}`;
        counts[k]=(counts[k]||0)+1;
      }
      const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
      if(!top) return data.accentColor;
      const [rS,gS,bS] = top[0].split(',');
      return `#${parseInt(rS).toString(16).padStart(2,'0')}${parseInt(gS).toString(16).padStart(2,'0')}${parseInt(bS).toString(16).padStart(2,'0')}`;
    } catch { return data.accentColor; }
  };

  const uploadToStorage = async(file:File):Promise<string|null>=>{
    if(!profile) return null;
    const ext = file.name.split('.').pop()??'png';
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const {error} = await supabase.storage.from('signature-images').upload(path,file,{upsert:true});
    if(error) return null;
    const {data:urlData} = supabase.storage.from('signature-images').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleLogoUpload = async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file = e.target.files?.[0]; if(!file) return;
    setUploadingLogo(true);
    const localUrl = URL.createObjectURL(file);
    set('logoUrl',localUrl);
    const img = new Image();
    img.onload = ()=>{ const color=extractDominantColor(img); setData(prev=>({...prev,accentColor:color})); URL.revokeObjectURL(localUrl); };
    img.src = localUrl;
    const publicUrl = await uploadToStorage(file);
    if(publicUrl){ set('logoUrl',publicUrl); } else { const reader=new FileReader(); reader.onload=()=>set('logoUrl',reader.result as string); reader.readAsDataURL(file); }
    setUploadingLogo(false);
    if(e.target) e.target.value='';
  };

  const renderSig = (d:SigData,s:StyleKey,lw=logoW,lp=logoPos)=>{
    let html:string;
    switch(s){
      case 'classic':  html=renderClassic(d,lw,lp);  break;
      case 'minimal':  html=renderMinimal(d,lw,lp);  break;
      case 'portrait': html=renderPortrait(d,lw,lp); break;
      case 'banner':   html=renderBanner(d,lw,lp);   break;
      case 'executive':html=renderExecutive(d,lw,lp);break;
      case 'divider':  html=renderDivider(d,lw,lp);  break;
      case 'agency':   html=renderAgency(d,lw,lp);   break;
      case 'creative': html=renderCreative(d,lw,lp); break;
      default:         html=renderModern(d,lw,lp);
    }
    // For styles that don't embed socials internally, append icon row
    const embedsSocials=['portrait','banner','executive','agency','creative'].includes(s);
    if(!embedsSocials){
      const socialHtml = buildSocialIconsHtml(d, 24);
      if(socialHtml) html+=`\n<div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;">${socialHtml}</div>`;
    }
    return html;
  };

  const htmlString = renderSig(data,style);
  const plainString = renderPlainText(data);

  const handleCopy = async()=>{
    try{ const blob=new Blob([htmlString],{type:'text/html'}); const plain=new Blob([plainString],{type:'text/plain'}); await navigator.clipboard.write([new ClipboardItem({'text/html':blob,'text/plain':plain})]); }catch{ await navigator.clipboard.writeText(htmlString); }
    setCopied(true); setTimeout(()=>setCopied(false),2500);
  };

  const handleDownload=()=>{
    const fullHtml=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Email Signature</title></head><body style="margin:20px;background:#f9fafb;">${htmlString}</body></html>`;
    const blob=new Blob([fullHtml],{type:'text/html'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='email-signature.html'; a.click(); URL.revokeObjectURL(url);
  };

  const inputCls='w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition';

  return (
    <main className="p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6" style={{color:'#5864C6'}}/>Email Signature
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Build a professional email signature with a "Schedule a meeting" button. Copy directly into Gmail or Outlook.
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-800">
        {([
          { key: 'editor' as const, icon: Palette, label: 'Editor' },
          { key: 'instructions' as const, icon: BookOpen, label: 'Instructions' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setPageTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              pageTab === key
                ? 'border-[#5864C6] text-[#5864C6]'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'editor' && (
        <div className="space-y-8 max-w-3xl">

          {isExample && (
            <div style={{background:'#5864C610',border:'1px solid #5864C6',borderRadius:'8px',padding:'12px',color:'#5864C6',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
              <span className="text-sm font-medium">&#9999;&#65039; This is an example — click any field to make it yours</span>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <button onClick={saveData} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90" style={{backgroundColor:'#5864C6'}}>Save my info</button>
                <button onClick={()=>setIsExample(false)} className="text-xs opacity-60 hover:opacity-100 transition-opacity" style={{color:'#5864C6'}}>✕</button>
              </div>
            </div>
          )}

          {/* Style carousel */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Style</p>
            <div className="flex items-center gap-3">
              <button onClick={goPrev} className="shrink-0 h-14 w-14 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm" aria-label="Previous style">
                <ChevronLeft className="h-7 w-7 text-slate-600 dark:text-slate-300"/>
              </button>
              <div className="flex-1 rounded-xl border-2 border-slate-900 dark:border-slate-200 bg-white dark:bg-slate-900/50 p-4 transition-all">
                <CarouselPreview htmlString={htmlString} />
                <div className="flex items-center justify-end mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                    {styleIndex + 1} / {STYLES.length}
                  </span>
                </div>
              </div>
              <button onClick={goNext} className="shrink-0 h-14 w-14 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm" aria-label="Next style">
                <ChevronRight className="h-7 w-7 text-slate-600 dark:text-slate-300"/>
              </button>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {STYLES.map((s, i) => (
                <button key={s.key} onClick={() => setStyle(s.key)} className={`rounded-full transition-all ${i === styleIndex ? 'w-4 h-2 bg-slate-900 dark:bg-slate-200' : 'w-2 h-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'}`} aria-label={s.label}/>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-white hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>
                {copied?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}
                {copied?'Copied!':'Copy signature'}
              </button>
              <button onClick={handleDownload} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                <Download className="h-4 w-4"/>Download .html
              </button>
            </div>
          </div>

          {/* Accent color */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5"/>Color
              <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">— auto-matched from uploaded logo</span>
            </p>
            <div className="flex gap-2.5 flex-wrap items-center">
              <ColorSwatchRow value={data.accentColor} onChange={(c) => set('accentColor', c)} />
            </div>
          </div>

          {/* Core details */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Your details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Full name</label>
                <input type="text" value={data.fullName} onChange={e=>set('fullName',e.target.value)} placeholder="Jane Smith" className={inputCls}/>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Mail className="h-3 w-3"/>Email</label>
                <input type="email" value={data.email} onChange={e=>set('email',e.target.value)} placeholder="jane@company.com" className={inputCls}/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{color:'#5864C6'}}><CalendarDays className="h-3 w-3"/>Booking link</label>
                <input type="url" value={data.bookingUrl} onChange={e=>set('bookingUrl',e.target.value)} placeholder="https://pinonit.com/yourname" className={inputCls}/>
              </div>
            </div>
          </div>

          {/* Additional details */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Additional details</p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Job title</label>
                  <input type="text" value={data.title} onChange={e=>set('title',e.target.value)} placeholder="CEO" className={inputCls}/>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Company</label>
                  <input type="text" value={data.company} onChange={e=>set('company',e.target.value)} placeholder="Acme Inc." className={inputCls}/>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Phone className="h-3 w-3"/>Phone</label>
                <input type="tel" value={data.phone} onChange={e=>{set('phone',e.target.value);validatePhone(e.target.value);}} placeholder="+1 (555) 000-0000" className={`${inputCls} ${phoneError?'border-red-400 focus:ring-red-400':''}`}/>
                {phoneError&&<p className="text-xs text-red-500 mt-1">{phoneError}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Globe className="h-3 w-3"/>Website</label>
                <input type="text" value={data.website} onChange={e=>{set('website',e.target.value);validateUrl(e.target.value);}} placeholder="https://yourwebsite.com" className={`${inputCls} ${websiteError?'border-red-400 focus:ring-red-400':''}`}/>
                {websiteError&&<p className="text-xs text-red-500 mt-1">{websiteError}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Address</label>
                <input type="text" value={data.address} onChange={e=>set('address',e.target.value)} placeholder="123 Main St, New York, NY" className={inputCls}/>
              </div>

              {/* Logo upload */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Logo / Photo <span className="text-slate-400">— accent color auto-matched on upload</span>
                </label>
                <div className="flex items-start gap-3">
                  {data.logoUrl&&(
                    <div className="relative shrink-0">
                      <img src={data.logoUrl} alt="Logo" className="h-12 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white"/>
                      <button onClick={()=>set('logoUrl','')} className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-400 transition-colors">
                        <X className="h-3 w-3"/>
                      </button>
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only"/>
                    <button onClick={()=>logoInputRef.current?.click()} disabled={uploadingLogo} className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:border-[#5864C6] hover:text-[#5864C6] transition-colors disabled:opacity-60">
                      {uploadingLogo?<Loader2 className="h-4 w-4 animate-spin"/>:<Upload className="h-4 w-4"/>}
                      {uploadingLogo?'Uploading to cloud...':'Upload logo or photo'}
                    </button>
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">— or paste a URL —</p>
                    <input type="url" value={data.logoUrl.startsWith('data:')||data.logoUrl.startsWith('blob:')?'':data.logoUrl} onChange={e=>set('logoUrl',e.target.value)} placeholder="https://yoursite.com/logo.png" className={inputCls}/>
                  </div>
                </div>
              </div>

              {/* Logo size + position */}
              {data.logoUrl && (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-slate-500 dark:text-slate-400">Logo size</label>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{logoW}px</span>
                    </div>
                    <input
                      type="range" min={40} max={200} step={4} value={logoW}
                      onChange={e=>handleLogoW(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 cursor-pointer" style={{accentColor:'#5864C6'}}
                    />
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-slate-400">40px</span>
                      <span className="text-[10px] text-slate-400">200px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Logo position</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        {key:'top-left' as LogoPosition, label:'Top left'},
                        {key:'top-right' as LogoPosition, label:'Top right'},
                        {key:'inline' as LogoPosition, label:'Inline'},
                      ]).map(({key,label})=>(
                        <button
                          key={key}
                          onClick={()=>handleLogoPos(key)}
                          className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${logoPos===key?'border-[#5864C6] text-[#5864C6]':'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Social links */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Social links
                </p>
                <div className="space-y-2">
                  {SOCIAL_INPUT_ROWS.map(({key,icon,label,placeholder})=>(
                    <div key={key} className="flex items-center gap-2">
                      <img src={icon} alt={label} className="h-5 w-5 shrink-0 rounded" />
                      <input
                        type="url"
                        value={data[key]}
                        onChange={e=>set(key,e.target.value)}
                        placeholder={placeholder}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Instructions tab */}
      {pageTab === 'instructions' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Get your signature</p>
            <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-white hover:opacity-90" style={{ backgroundColor: '#5864C6' }}>
              {copied?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}
              {copied?'Copied!':'Copy signature'}
            </button>
            <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
              <Download className="h-4 w-4"/>Download .html file
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">How to add to your email app</p>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-red-500"/>
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Gmail</p>
              </div>
              <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed text-sm text-slate-600 dark:text-slate-400">
                <li>Click <strong className="text-slate-700 dark:text-slate-200">Copy signature</strong> above</li>
                <li>Open Gmail → Gear icon → <em>See all settings</em> → <em>General</em> tab</li>
                <li>Scroll to Signature section → click inside the box → paste</li>
                <li>Click <strong className="text-slate-700 dark:text-slate-200">Save Changes</strong> at the bottom</li>
              </ol>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-blue-500"/>
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Outlook</p>
              </div>
              <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed text-sm text-slate-600 dark:text-slate-400">
                <li>Click <strong className="text-slate-700 dark:text-slate-200">Copy signature</strong> above</li>
                <li>Go to <em>File</em> → <em>Options</em> → <em>Mail</em> → <em>Signatures…</em></li>
                <li>Select or create a signature, then paste into the editor</li>
                <li>Click <strong className="text-slate-700 dark:text-slate-200">OK</strong> to save</li>
              </ol>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-slate-500"/>
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Apple Mail</p>
              </div>
              <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed text-sm text-slate-600 dark:text-slate-400">
                <li>Click <strong className="text-slate-700 dark:text-slate-200">Download .html file</strong> above</li>
                <li>Open the downloaded file in Safari — select all (⌘A) → copy (⌘C)</li>
                <li>In Mail → Settings → Signatures → click <strong className="text-slate-700 dark:text-slate-200">+</strong> → paste</li>
              </ol>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pro tip</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              If pasting into Gmail strips the formatting, try using the <strong>Download .html file</strong> option, open it in Chrome, select all, then paste directly into Gmail's signature editor.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
