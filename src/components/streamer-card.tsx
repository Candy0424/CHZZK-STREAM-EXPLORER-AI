"use client";
import { useState } from "react";
import { ArrowUpRight, BadgeCheck, Eye, Heart, Moon, Shield, Radio, Clock3 } from "lucide-react";
import type { Streamer } from "@/types/streamer";
import { channelUrl, safeImageUrl } from "@/lib/channel-url";
export function elapsed(date: string | null, now: number) {
  if (!date) return "확인 기록 없음";
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 전`;
  return `${Math.floor(minutes / 1440)}일 전`;
}
export function StreamerCard({
  streamer,
  favorite,
  onFavorite,
  onOpen,
  stale,
  now,
}: {
  streamer: Streamer;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: (streamer: Streamer) => void;
  stale: boolean;
  now: number;
}) {
  const [failedImage, setFailedImage] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState(false);
  const online = streamer.status === "ONLINE";
  const delayed = stale || streamer.status === "UNKNOWN";
  const image = safeImageUrl(streamer.thumbnailUrl?.replace("{type}", "480"));
  const avatar = safeImageUrl(streamer.channelImageUrl);
  const url = channelUrl(streamer.channelId);
  const initials = streamer.channelName.slice(0, 1);
  const content = (
    <>
      <div className={`thumbnail ${!online ? "offline-thumbnail" : ""} art-${streamer.categoryId}`}>
        {online ? (
          <>
            {image && !failedImage ? (
              <img
                className={`cover-image ${streamer.adult ? "adult-image" : ""}`}
                src={image}
                alt={
                  streamer.adult ? "연령 제한 방송 썸네일" : `${streamer.channelName} 방송 썸네일`
                }
                onError={() => setFailedImage(true)}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="image-fallback">
                <Radio size={38} />
                <span>방송을 만나보세요</span>
              </div>
            )}
            <span className="live-badge">
              <i /> LIVE
            </span>
            {streamer.adult && (
              <div className="adult-label">
                <Shield size={24} />
                <b>연령 제한</b>
                <span>치지직에서 확인해 주세요</span>
              </div>
            )}
            <span className="viewers">
              <Eye size={13} />
              {streamer.viewerCount.toLocaleString("ko-KR")}
            </span>
            <span className="duration">{elapsed(streamer.openDate, now).replace(" 전", "")}</span>
            <span className="watch-overlay">
              <ArrowUpRight size={26} />
            </span>
          </>
        ) : (
          <>
            <span className="offline-badge">
              <Moon size={12} />
              {streamer.status === "UNKNOWN" ? "UNKNOWN" : "OFFLINE"}
            </span>
            <div className="offline-person">
              <span>{initials}</span>
              <Moon size={16} />
            </div>
            <p>
              {streamer.status === "UNKNOWN"
                ? "방송 상태를 확인하고 있어요"
                : "다음 방송에서 만나요"}
            </p>
          </>
        )}
      </div>
      <div className="card-info">
        <div className={`avatar avatar-${streamer.categoryId}`}>
          {avatar && !failedAvatar ? (
            <img
              src={avatar}
              alt=""
              onError={() => setFailedAvatar(true)}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            initials
          )}
        </div>
        <div className="card-copy">
          <div className="channel-name">
            {streamer.channelName}
            {streamer.verifiedMark && <BadgeCheck size={14} />}
          </div>
          <h3 title={streamer.liveTitle}>{streamer.liveTitle}</h3>
          <p className="card-category">{streamer.categoryName}</p>
          <div className="tag-list">
            {streamer.tags.slice(0, 2).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
            {!online && (
              <span className="last-seen">
                <Clock3 size={11} />
                {elapsed(streamer.lastSeenLiveAt, now)}
              </span>
            )}
          </div>
          {delayed && (
            <span className="card-delay">
              상태 확인 지연 · 마지막 확인 {elapsed(streamer.lastCheckedAt, now)}
            </span>
          )}
        </div>
      </div>
    </>
  );
  return (
    <article
      className={`streamer-card ${online ? "online-card" : "offline-card"}`}
      data-status={streamer.status}
    >
      {online && url ? (
        streamer.demo ? (
          <button
            className="card-main"
            onClick={() => onOpen(streamer)}
            aria-label={`${streamer.channelName} 샘플 방송 정보 보기`}
          >
            {content}
          </button>
        ) : (
          <a
            className="card-main"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen(streamer)}
            aria-label={`${streamer.channelName}: ${streamer.liveTitle} — 치지직에서 방송 보기 (새 탭)`}
          >
            {content}
          </a>
        )
      ) : (
        <div className="card-main">{content}</div>
      )}
      <button
        className={`favorite-button ${favorite ? "is-favorite" : ""}`}
        aria-pressed={favorite}
        aria-label={`${streamer.channelName} 즐겨찾기 ${favorite ? "해제" : "추가"}`}
        onClick={onFavorite}
      >
        <Heart size={16} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
