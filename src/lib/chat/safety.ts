import type { Level } from "../learning/curriculum";

const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[’']/g, "");
export function inputRisk(message: string): "urgent" | "private" | "unsafe" | "injection" | null {
  const text = normalize(message);
  if (/\b(kill myself|hurt myself|want to die|suicide|someone hurt|hurt me|touching me|not safe|abuse|bleeding)\b/.test(text)) return "urgent";
  if (/@|https?:|www\.|\b\d[\d\s()+-]{5,}\d\b|\b(my name is|my address|my phone|my password|i live at|i live in|my school is|my email|call me)\b/.test(text)) return "private";
  if (/\b(sex|naked|porn|fuck|shit|bitch|kill|murder|gun|weapon|blood|drugs|suicid\w*)\b/.test(text)) return "unsafe";
  if (/\b(ignore|override|system|developer|instructions?|prompt|jailbreak|api key|password|secret|roleplay|pretend you|act as|base64)\b|[<>\[\]{}]|```/.test(text)) return "injection";
  return null;
}

// Conservative vocabulary gate: unknown words fall back instead of guessing safety.
const basic = new Set(`a an the i im you your we us our me my it its is am are be being feel feels feeling feelings matter sad happy glad mad angry scared okay ok safe can could may lets let s do does did dont not no yes and or but so to for with of in on at as this that these those what which how would like love enjoy try trying tried good great little small big soft kind nice fun play playing game games friend friends buddy bear cat cats dog dogs duck ducks bird birds animal animals red blue green yellow color colors book books read reading story toy toys ball apple apples banana bananas food eat eating help helps ask talk talking tell share sharing thank thanks take taking break rest breathe slowly together here hear listen listening now today again one two three time rain rainy sun sunny sky run jump dance clap smile smiles smiling grow learning learn practise practice proud effort brave curious calm trusted grown up adult grownup someone about something want choose choice name`.split(/\s+/));
const l2 = new Set("because when if then also favorite make makes made find found see saw went go going walk sing draw picture rainbow outside inside soft sounds sound understand keep kept new different tell want need help feeling sharing beautiful very really more much many all some every say says said know think about wonderful animal curious feeling hard easy better best welcome thank look looks looking colorful sing singing dance dancing heart takes takes dry reach why has have had how who where into out will do done".split(/\s+/));
const l3 = new Set("describe imagine adventure explore story stories together kindness excited worried lonely upset notice noticed question questions answer answers practice progress effort discover gentle patient patience celebrate proud understand helpful interesting tomorrow yesterday after before during surprise surprised wonderful choices sharing learning confidence".split(/\s+/));
export function isSafeReply(reply: string, level: Level): boolean {
  if (!reply || reply.length > 240 || /[<>\[\]{}@/\\:;\d\n\r]/.test(reply)) return false;
  if (inputRisk(reply) || /\b(name|address|phone|email|school|password|secret|meet|alone|promise|forever|only friend|love you|need you|dont tell|do not tell)\b/i.test(reply)) return false;
  if (!/^[A-Za-z\s.,!?'’-]+$/.test(reply)) return false;
  const sentences = reply.match(/[^.!?]+[.!?]*/g)?.map(s => s.trim()).filter(Boolean) ?? [];
  const maxWords = level === "L1" ? 10 : level === "L2" ? 13 : 16;
  if (!sentences.length || sentences.length > 2 || (reply.match(/\?/g)?.length ?? 0) > 1) return false;
  const allowed = new Set([...basic, ...(level !== "L1" ? l2 : []), ...(level === "L3" ? l3 : [])]);
  for (const sentence of sentences) {
    const words = normalize(sentence).replace(/[-]/g, " ").match(/[a-z]+/g) ?? [];
    if (!words.length || words.length > maxWords || words.some(word => !allowed.has(word))) return false;
  }
  return true;
}

