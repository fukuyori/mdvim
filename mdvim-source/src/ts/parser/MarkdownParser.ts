/**
 * Markdown Parser
 * メインのパーサークラス
 */

import { parseMarkdown } from './BlockParser';
import { parseInline, parseEmoji } from './InlineParser';
import type { TocEntry, ParseResult } from '../types';

/**
 * MarkdownParser クラス
 */
export class MarkdownParser {
  private headingCount = 0;
  
  /**
   * Markdownをパース
   */
  parse(markdown: string): ParseResult {
    this.headingCount = 0;
    const result = parseMarkdown(markdown);
    return {
      html: result.html,
      toc: result.toc
    };
  }
  
  /**
   * インライン要素のみパース
   */
  parseInline(text: string): string {
    return parseInline(text);
  }
  
  /**
   * 絵文字変換
   */
  parseEmoji(text: string): string {
    return parseEmoji(text);
  }
  
  /**
   * 目次を生成
   */
  generateToc(markdown: string): TocEntry[] {
    const result = parseMarkdown(markdown);
    return result.toc;
  }
  
  /**
   * 目次HTMLを生成
   */
  generateTocHtml(toc: TocEntry[]): string {
    if (toc.length === 0) return '';
    
    let html = '<div class="toc-list">';
    
    for (const entry of toc) {
      const indent = (entry.level - 1) * 12;
      html += `<div class="toc-entry toc-h${entry.level}" style="padding-left: ${indent}px" data-line="${entry.line}">`;
      html += entry.text;
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }
}

// シングルトンインスタンス
export const markdownParser = new MarkdownParser();

// 後方互換性のためのエクスポート
export { parseMarkdown, parseInline, parseEmoji };
