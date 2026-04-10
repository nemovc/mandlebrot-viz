<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';
  if (browser) goto(resolve('/viewer'));
</script>
