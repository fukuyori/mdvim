/**
 * Inline Markdown Parser
 * インライン要素（強調、リンク、コードなど）のパース
 */

import { escapeHtml } from '../utils/string';

/** 絵文字マップ */
const EMOJI_MAP: Record<string, string> = {
  ':smile:': '😄', ':laughing:': '😆', ':blush:': '😊', ':smiley:': '😃',
  ':relaxed:': '☺️', ':smirk:': '😏', ':heart_eyes:': '😍', ':kissing_heart:': '😘',
  ':kissing:': '😗', ':flushed:': '😳', ':relieved:': '😌', ':satisfied:': '😆',
  ':grin:': '😁', ':wink:': '😉', ':stuck_out_tongue_winking_eye:': '😜',
  ':stuck_out_tongue:': '😛', ':sleeping:': '😴', ':worried:': '😟',
  ':frowning:': '😦', ':anguished:': '😧', ':open_mouth:': '😮', ':grimacing:': '😬',
  ':confused:': '😕', ':hushed:': '😯', ':expressionless:': '😑', ':unamused:': '😒',
  ':sweat_smile:': '😅', ':sweat:': '😓', ':weary:': '😩', ':pensive:': '😔',
  ':disappointed:': '😞', ':confounded:': '😖', ':fearful:': '😨', ':cold_sweat:': '😰',
  ':persevere:': '😣', ':cry:': '😢', ':sob:': '😭', ':joy:': '😂', ':astonished:': '😲',
  ':scream:': '😱', ':tired_face:': '😫', ':angry:': '😠', ':rage:': '😡',
  ':triumph:': '😤', ':sleepy:': '😪', ':yum:': '😋', ':mask:': '😷',
  ':sunglasses:': '😎', ':dizzy_face:': '😵', ':imp:': '👿', ':smiling_imp:': '😈',
  ':neutral_face:': '😐', ':no_mouth:': '😶', ':innocent:': '😇', ':alien:': '👽',
  ':heart:': '❤️', ':broken_heart:': '💔', ':star:': '⭐', ':star2:': '🌟',
  ':sparkles:': '✨', ':zap:': '⚡', ':fire:': '🔥', ':boom:': '💥',
  ':+1:': '👍', ':thumbsup:': '👍', ':-1:': '👎', ':thumbsdown:': '👎',
  ':ok_hand:': '👌', ':punch:': '👊', ':fist:': '✊', ':v:': '✌️',
  ':wave:': '👋', ':hand:': '✋', ':clap:': '👏', ':pray:': '🙏',
  ':point_up:': '☝️', ':point_down:': '👇', ':point_left:': '👈', ':point_right:': '👉',
  ':rocket:': '🚀', ':warning:': '⚠️', ':x:': '❌', ':white_check_mark:': '✅',
  ':heavy_check_mark:': '✔️', ':question:': '❓', ':exclamation:': '❗',
  ':bulb:': '💡', ':memo:': '📝', ':book:': '📖', ':bookmark:': '🔖',
  ':link:': '🔗', ':wrench:': '🔧', ':hammer:': '🔨', ':nut_and_bolt:': '🔩',
  ':gear:': '⚙️', ':package:': '📦', ':tada:': '🎉', ':100:': '💯',
  ':bug:': '🐛', ':construction:': '🚧', ':rotating_light:': '🚨',
  ':lock:': '🔒', ':unlock:': '🔓', ':key:': '🔑', ':mag:': '🔍',
  ':email:': '📧', ':phone:': '📱', ':computer:': '💻', ':desktop_computer:': '🖥️',
  ':folder:': '📁', ':file_folder:': '📂', ':clipboard:': '📋',
  ':calendar:': '📅', ':clock:': '🕐', ':hourglass:': '⌛',
  ':sun:': '☀️', ':moon:': '🌙', ':cloud:': '☁️', ':umbrella:': '☂️',
  ':snowflake:': '❄️', ':coffee:': '☕', ':beer:': '🍺', ':pizza:': '🍕'
};

/**
 * 絵文字ショートコードを変換
 */
export function parseEmoji(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/g, (match) => {
    return EMOJI_MAP[match] || match;
  });
}

/**
 * インライン要素をパース
 */
export function parseInline(text: string): string {
  let result = text;
  
  // インライン数式 $...$ を処理（$$を除外）
  result = result.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_match, formula: string) => {
    return `<span class="math-inline" data-math="${escapeHtml(formula)}"></span>`;
  });
  
  // インラインコード
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 画像（リンクや強調より先に処理 - ファイル名の_がイタリック化されるのを防ぐ）
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  
  // リンク（強調より先に処理 - URL内の_がイタリック化されるのを防ぐ）
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // 取り消し線
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // 太字（** と __）
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // 斜体（* と _）
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // 自動リンク（URLを自動でリンク化）
  result = result.replace(
    /(?<!href="|src="|<a[^>]*>)(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1">$1</a>'
  );
  
  // 絵文字ショートコード
  result = parseEmoji(result);
  
  return result;
}

/**
 * インライン要素をパース（ソースマップ付き）
 */
export function parseInlineWithSourceMap(
  text: string,
  lineNumber: number
): { html: string; sourceMap: Map<number, string> } {
  const sourceMap = new Map<number, string>();
  const html = parseInline(text);
  sourceMap.set(lineNumber, html);
  return { html, sourceMap };
}
