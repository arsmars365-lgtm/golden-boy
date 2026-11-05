import type { Item } from "@/lib/items";

const ignoredWords = new Set([
  "для",
  "или",
  "над",
  "под",
  "это",
  "эта",
  "этот",
  "есть",
  "мой",
  "моя",
  "мое",
  "мои",
  "the",
  "and",
  "for",
  "with",
]);

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !ignoredWords.has(word)),
  );
}

export function getSimilarFoundItems(lostItem: Item, items: Item[]): Item[] {
  if (lostItem.type !== "lost") return [];
  const lostWords = titleWords(lostItem.title);

  return items
    .filter((candidate) => {
      if (candidate.id === lostItem.id || candidate.type !== "found" || candidate.status === "returned") {
        return false;
      }
      if (candidate.category === lostItem.category) return true;
      const candidateWords = titleWords(candidate.title);
      return [...lostWords].some((word) => candidateWords.has(word));
    })
    .sort((first, second) => first.daysAgo - second.daysAgo);
}

export function getLostItemProgress(item: Item, hasPossibleMatch: boolean): number {
  if (item.status === "returned") return 3;
  if (item.status === "found") return 2;
  return hasPossibleMatch ? 2 : 1;
}
