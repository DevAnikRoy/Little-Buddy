export const LEVELS = ["L1", "L2", "L3"] as const;
export type Level = typeof LEVELS[number];
export const SKILLS = ["colors", "animals", "preferences", "sentences", "descriptions", "stories"] as const;
export type Skill = typeof SKILLS[number];
export type Activity = { id: string; level: Level; skill: Skill; prompt: string; answers: readonly string[]; choices: readonly string[]; hint: string };
const make = (id: string, level: Level, skill: Skill, prompt: string, answers: string[], choices: string[], hint: string): Activity => ({ id, level, skill, prompt, answers, choices, hint });
export const ACTIVITIES: readonly Activity[] = [
  make("color-red", "L1", "colors", "An apple is red. What color is it?", ["red", "it is red", "the apple is red"], ["Red", "Blue", "Yellow"], "Try the color that starts with R."),
  make("color-blue", "L1", "colors", "The sky is blue. What color is it?", ["blue", "it is blue", "the sky is blue"], ["Green", "Blue", "Red"], "It starts with B: bl..."),
  make("color-yellow", "L1", "colors", "A banana is yellow. What color is it?", ["yellow", "it is yellow", "the banana is yellow"], ["Yellow", "Blue", "Red"], "It starts with Y: yell..."),
  make("animal-cat", "L1", "animals", "Which animal says meow?", ["cat", "a cat", "the cat"], ["Dog", "Cat", "Duck"], "It starts with C and has whiskers."),
  make("animal-dog", "L1", "animals", "Which animal says woof?", ["dog", "a dog", "the dog"], ["Cat", "Duck", "Dog"], "It starts with D and likes to bark."),
  make("animal-duck", "L1", "animals", "Which animal says quack?", ["duck", "a duck", "the duck"], ["Duck", "Dog", "Cat"], "It starts with D and has a beak."),
  make("like-cats", "L2", "preferences", "Tell Buddy you like cats. Start with: I like...", ["i like cats"], ["I like cats", "I like dogs", "I like birds"], "Put cats after I like."),
  make("like-apples", "L2", "preferences", "Tell Buddy you like apples. Start with: I like...", ["i like apples"], ["I like books", "I like apples", "I like cats"], "Put apples after I like."),
  make("like-books", "L2", "preferences", "Tell Buddy you like books. Start with: I like...", ["i like books"], ["I like apples", "I like cats", "I like books"], "Put books after I like."),
  make("sentence-cat", "L2", "sentences", "Finish the sentence: The cat is...", ["the cat is small", "small"], ["The cat is small", "The dog is small", "A blue cat"], "Small tells us about the cat."),
  make("sentence-dog", "L2", "sentences", "Finish the sentence: The dog can...", ["the dog can run", "run"], ["The cat can run", "The dog can run", "A yellow dog"], "Run is something a dog can do."),
  make("sentence-book", "L2", "sentences", "Finish the sentence: This is a...", ["this is a book", "book", "a book"], ["This is a cat", "This is a ball", "This is a book"], "A book has pages to read."),
  make("describe-ball", "L3", "descriptions", "The ball is big and red. Tell Buddy two things about the ball.", ["big and red", "red and big", "the ball is big and red", "it is big and red"], ["Big and red", "Small and blue", "A cat"], "Tell its size and its color: big and..."),
  make("describe-cat", "L3", "descriptions", "The cat is small and soft. Tell Buddy two things about the cat.", ["small and soft", "soft and small", "the cat is small and soft", "it is small and soft"], ["Big and red", "Small and soft", "A book"], "Tell its size and how it feels: small and..."),
  make("describe-duck", "L3", "descriptions", "The duck is yellow and happy. Tell Buddy two things about the duck.", ["yellow and happy", "happy and yellow", "the duck is yellow and happy", "it is yellow and happy"], ["Small and blue", "Big and red", "Yellow and happy"], "Tell its color and feeling: yellow and..."),
  make("story-share", "L3", "stories", "Mia shares a toy with Ben. Ben smiles. How does Ben feel?", ["happy", "ben is happy", "he is happy", "ben feels happy"], ["Happy", "Sad", "Angry"], "A smile can show this feeling. It starts with H."),
  make("story-rain", "L3", "stories", "It is raining. Sam takes an umbrella to stay dry. What does Sam take?", ["umbrella", "an umbrella", "sam takes an umbrella"], ["A book", "An umbrella", "A toy"], "It opens above your head to keep rain away."),
  make("story-help", "L3", "stories", "Ava cannot reach a book. A grown-up helps her. Who helps Ava?", ["a grown up", "grown up", "a grownup", "grownup", "a grown up helps ava"], ["A duck", "A ball", "A grown-up"], "A trusted adult can help us."),
];
export const SKILL_LEVEL: Record<Skill, Level> = { colors: "L1", animals: "L1", preferences: "L2", sentences: "L2", descriptions: "L3", stories: "L3" };
export function skillsForLevel(level: Level): Skill[] {
  return SKILLS.filter(skill => SKILL_LEVEL[skill] === level);
}
export function getActivity(id: string): Activity {
  const activity = ACTIVITIES.find(a => a.id === id);
  if (!activity) throw new Error("Unknown activity");
  return activity;
}
