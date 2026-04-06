<script lang="ts">
  import { samplePalette } from "$lib/utils/colorPalettes";
  import type { ColorConfig } from "$lib/utils/colorPalettes";

  let {
    colors,
    class: extraClass = "",
  }: { colors: ColorConfig; class?: string } = $props();

  const gradient = $derived(
    (() => {
      const { palette, offset, reverse } = colors;

      const displayStops = palette
        .map(({ stop, color }) => {
          const d = reverse ? 1 - stop : stop;
          return { pos: d - offset + (d < offset ? 1 : 0), color };
        })
        .sort((a, b) => a.pos - b.pos);

      const edgeT = reverse ? 1 - offset : offset;
      const [r, g, b] = samplePalette(palette, edgeT);
      const edgeColor = `rgb(${r},${g},${b})`;

      const parts = [
        `${edgeColor} 0%`,
        ...displayStops.map(
          ({ pos, color }) => `${color} ${(pos * 100).toFixed(2)}%`,
        ),
        `${edgeColor} 100%`,
      ];

      return `linear-gradient(to right, ${parts.join(", ")})`;
    })(),
  );
</script>

<div class="h-4 rounded grow {extraClass}" style="background: {gradient}"></div>
