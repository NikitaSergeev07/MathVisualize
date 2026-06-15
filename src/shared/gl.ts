// Minimal WebGL2 helpers shared by the shader visualizations
// (reaction-diffusion, Newton fractals). Just enough to compile programs and
// draw a full-screen triangle.

export function getGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    preserveDrawingBuffer: true, // needed so PNG export / recording capture pixels
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  return gl;
}

export function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compile error:\n' + log + '\n--- source ---\n' + withLineNumbers(src));
  }
  return sh;
}

export function program(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('Program link error:\n' + gl.getProgramInfoLog(p));
  }
  return p;
}

function withLineNumbers(src: string): string {
  return src
    .split('\n')
    .map((l, i) => `${String(i + 1).padStart(3, ' ')}| ${l}`)
    .join('\n');
}

/** A full-screen triangle covering clip space — bind once and drawArrays(3). */
export function fullscreenTriangle(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

export const VERT_FULLSCREEN = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** Create an RGBA(/float) texture sized w x h. */
export function createTexture(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  opts: { internalFormat?: number; format?: number; type?: number; filter?: number; data?: ArrayBufferView | null } = {},
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const filter = opts.filter ?? gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    opts.internalFormat ?? gl.RGBA,
    w,
    h,
    0,
    opts.format ?? gl.RGBA,
    opts.type ?? gl.UNSIGNED_BYTE,
    opts.data ?? null,
  );
  return tex;
}
