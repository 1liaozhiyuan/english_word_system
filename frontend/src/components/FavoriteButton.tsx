import { Star } from 'lucide-react';
import React from 'react';
import { favoriteWord, getFavoriteStatus, unfavoriteWord } from '../api/favorites';
import { useAuth } from '../auth/AuthContext';

export function FavoriteButton({
  wordId,
  initialFavorite = false,
  disabled = false,
  compact = false,
  onChange,
}: {
  wordId: number;
  initialFavorite?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange?: (isFavorite: boolean) => void;
}) {
  const { token } = useAuth();
  const [isFavorite, setIsFavorite] = React.useState(initialFavorite);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setIsFavorite(initialFavorite);
    getFavoriteStatus(token, wordId)
      .then((result) => {
        if (alive) setIsFavorite(result.is_favorite);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token, wordId, initialFavorite]);

  async function toggleFavorite() {
    if (disabled || isLoading) return;
    setIsLoading(true);
    try {
      const result = isFavorite
        ? await unfavoriteWord(token, wordId)
        : await favoriteWord(token, wordId);
      setIsFavorite(result.is_favorite);
      onChange?.(result.is_favorite);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      className={isFavorite ? 'button-primary' : 'button-secondary'}
      disabled={disabled || isLoading}
      onClick={toggleFavorite}
      title={isFavorite ? '取消收藏' : '收藏单词'}
      type="button"
    >
      <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
      {!compact && (isFavorite ? '已收藏' : '收藏')}
    </button>
  );
}
