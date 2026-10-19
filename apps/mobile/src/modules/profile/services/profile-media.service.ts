import {
  mediaOwner,
  pickMedia,
  uploadMedia,
  signedMedia,
  type MediaDraft,
} from "../../../shared/services/media-upload";
export const profileMediaService = {
  pick: (kind: "avatar" | "cover") => pickMedia({ kind }),
  async upload(userId: string, kind: "avatar" | "cover", asset: MediaDraft) {
    await mediaOwner(userId);
    const path = `${userId}/${kind}/${asset.id}.${asset.extension}`;
    await uploadMedia("profile-media", path, asset);
    return path;
  },
  async urls(userId: string, avatarPath?: string, coverPath?: string) {
    const paths = [avatarPath, coverPath].filter(
      (path): path is string =>
        !!path && path.startsWith(`${userId}/`) && !path.includes(".."),
    );
    const signed = await signedMedia("profile-media", paths);
    return {
      avatarUrl: avatarPath ? signed.get(avatarPath) : undefined,
      coverUrl: coverPath ? signed.get(coverPath) : undefined,
    };
  },
};
