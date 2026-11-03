"use client";

import type { Plan } from "@/lib/types";
import { shot } from "@/engine/thumbs";
import { RING, SOCKET, STEM } from "../Logo";

const W = 1080;
const H = 1350;

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function load(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** Shrinks text until it fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, family: string, weight: number) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 4;
  } while (ctx.measureText(text).width > max && s > 40);
}

/** The logo as the header draws it: "assemble.help" in white on the blue block, its a the bolt. `top` is the block's top edge. */
function logo(ctx: CanvasRenderingContext2D, x: number, top: number, size: number, family: string, brand: string, soft: string) {
  ctx.font = `800 ${size}px ${family}`;
  ctx.letterSpacing = `${-0.04 * size}px`;
  const [aw, ah] = [0.58 * size, 0.56 * size];
  const [padX, padT, padB] = [0.36 * size, 0.2 * size, 0.26 * size];
  const rest = ctx.measureText("ssemble");
  const w = padX * 2 + aw + 0.015 * size + rest.width + ctx.measureText(".help").width;
  round(ctx, x, top, w, padT + size + padB, size / 8);
  ctx.fillStyle = brand;
  ctx.fill();
  // the baseline of a line box one em tall, as the CSS sets it
  const base = top + padT + (size - rest.fontBoundingBoxAscent - rest.fontBoundingBoxDescent) / 2 + rest.fontBoundingBoxAscent;
  const sX = x + padX + aw + 0.015 * size;
  ctx.fillStyle = "#fff";
  ctx.fillText("ssemble", sX, base);
  ctx.save();
  ctx.translate(x + padX, base + 0.02 * size - ah);
  ctx.scale(aw / 33, ah / 32);
  ctx.fill(new Path2D(RING), "evenodd");
  ctx.fill(new Path2D(STEM));
  ctx.fill(new Path2D(SOCKET));
  ctx.restore();
  ctx.fillStyle = soft;
  ctx.fillText(".help", sX + rest.width, base);
  ctx.letterSpacing = "0px";
}

/** A 4:5 picture of the finished piece, sized for a post on X or a story. */
export async function buildCard(plan: Plan, key: string, stat: string): Promise<Blob | null> {
  try {
    await document.fonts?.ready;
    const art = await shot(`card:${key}`, plan, { kind: "assembled" }, 900, 760);
    const img = await load(art.url);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const display = cssVar("--font-figtree", "system-ui, sans-serif");
    const body = display;
    const brand = cssVar("--brand", "#1d4f91");
    const soft = cssVar("--on-brand", "#dce6f3");

    ctx.fillStyle = "#edf1f6";
    ctx.fillRect(0, 0, W, H);
    round(ctx, 48, 48, W - 96, H - 96, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e3e9f0";
    ctx.stroke();

    // multiply, so the drawing's own white sheet melts into the card instead of showing as a box
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(img, 90, 96, 900, 760);
    ctx.globalCompositeOperation = "source-over";

    // the stamp: a check in the brand blue, like a finished page in a manual
    ctx.fillStyle = brand;
    ctx.beginPath();
    ctx.arc(W - 150, 150, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(W - 176, 152);
    ctx.lineTo(W - 156, 172);
    ctx.lineTo(W - 120, 132);
    ctx.stroke();

    ctx.fillStyle = "#536177";
    ctx.font = `600 30px ${body}`;
    ctx.letterSpacing = "4px";
    ctx.fillText("I BUILT", 110, 950);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#0f1c2e";
    fit(ctx, plan.spec.name, W - 220, 132, display, 800);
    ctx.fillText(plan.spec.name, 104, 1070);
    ctx.fillStyle = "#2f3d52";
    fit(ctx, plan.spec.variant, W - 220, 42, body, 500);
    ctx.fillText(plan.spec.variant, 110, 1130);

    ctx.fillStyle = "#0f1c2e";
    ctx.font = `700 38px ${body}`;
    ctx.fillText(stat, 110, 1206);

    ctx.strokeStyle = "#e3e9f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(110, 1236);
    ctx.lineTo(W - 110, 1236);
    ctx.stroke();
    logo(ctx, 110, 1247, 32, display, brand, soft);
    ctx.fillStyle = "#536177";
    ctx.font = `500 26px ${body}`;
    const host = location.host.replace(/^www\./, "");
    ctx.textAlign = "right";
    ctx.fillText(`Step by step in 3D, ${host}`, W - 110, 1280);
    ctx.textAlign = "left";

    return await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  } catch {
    return null;
  }
}
