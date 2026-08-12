/**
 * MOD-204 — lab artist profile fixture with production-aligned media URLs.
 * Does not mutate sealed MOCK_ARTIST_PROFILE_DJ_PRO (photoUrl remains null there).
 */

import {
  MOCK_ARTIST_PROFILE_DJ_PRO,
  type ArtistProfileReadDTO,
} from '../../shared/services/profiles/index';
import { LAB_IDENTITY_ARTIST_DJMAGO305 } from '../../shared/branding/lab-portal-identity-ssot';

/** Default lab artist profile — media from SSOT (dj_profiles photo/background). */
export const LAB_ARTIST_PROFILE_DJMAGO305: ArtistProfileReadDTO = Object.freeze({
  ...MOCK_ARTIST_PROFILE_DJ_PRO,
  userId: LAB_IDENTITY_ARTIST_DJMAGO305.userId,
  fullName: LAB_IDENTITY_ARTIST_DJMAGO305.legalName,
  stageName: LAB_IDENTITY_ARTIST_DJMAGO305.stageName || 'DJMago305',
  djName: LAB_IDENTITY_ARTIST_DJMAGO305.stageName || 'DJMago305',
  username: LAB_IDENTITY_ARTIST_DJMAGO305.username,
  djSlug: 'djmago305',
  photoUrl: LAB_IDENTITY_ARTIST_DJMAGO305.photoUrl,
  backgroundUrl: LAB_IDENTITY_ARTIST_DJMAGO305.backgroundUrl,
  mdjbId: LAB_IDENTITY_ARTIST_DJMAGO305.mdjbId,
  email: LAB_IDENTITY_ARTIST_DJMAGO305.email,
  /* MOD-213 — lab mock social handles (visual audit fix, 2026-08-12).
     ArtistProfileReadDTO.socialLinks stays null upstream until the real
     dj_profiles social columns are mapped; this lab fixture populates it
     so the profile view can render real badges instead of the "await DTO
     mapping" placeholder. */
  socialLinks: Object.freeze({
    instagram: 'https://instagram.com/djmago305',
    youtube: 'https://youtube.com/@djmago305',
    spotify: 'https://open.spotify.com/artist/djmago305',
    soundcloud: 'https://soundcloud.com/djmago305',
    mixcloud: null,
  }),
});

export const LAB_ARTIST_PROFILE_DEFAULT: ArtistProfileReadDTO = LAB_ARTIST_PROFILE_DJMAGO305;
