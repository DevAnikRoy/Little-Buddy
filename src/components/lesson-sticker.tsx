const KIND: Record<string, string> = {
  "color-red": "apple",
  "color-blue": "sky",
  "color-yellow": "banana",
  "animal-cat": "cat",
  "animal-dog": "dog",
  "animal-duck": "duck",
  "like-cats": "cat",
  "like-apples": "apple",
  "like-books": "book",
  "sentence-cat": "cat",
  "sentence-dog": "dog",
  "sentence-book": "book",
  "describe-ball": "ball",
  "describe-cat": "cat",
  "describe-duck": "duck",
  "story-share": "share",
  "story-rain": "rain",
  "story-help": "help",
};

export default function LessonSticker({ activityId }: { activityId: string }) {
  const kind = KIND[activityId] ?? "star";
  return (
    <div className={`lesson-sticker sticker-${kind}`} aria-hidden="true">
      <span className="sticker-face" />
    </div>
  );
}
