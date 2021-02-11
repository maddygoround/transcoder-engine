const event = {
  import: {
    agent: "/s3/import",
    region: "us-east-1",
    bucket: "transcode-input-bkt",
    key: "AKIA6OYUVTFHXGAR7QFN",
    secret: "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",
    path: "IAMICON_Russian.mp4",
  },
  watermark: {
    use: "import",
    agent: "/video/encode",
    watermark_alpha: 0.5,
    watermark_size: "25%",
    watermark_url:
      "https://demos.transloadit.com/inputs/transloadit-padded.png",
    watermark_position: "top-right",
  },
  hls_240: {
    use: "watermark",
    agent: "/video/encode",
    preset: "hls-240p",
  },
  hls_360: {
    use: "watermark",
    agent: "/video/encode",
    preset: "hls-360p",
  },
  hls_720: {
    use: "watermark",
    agent: "/video/encode",
    preset: "hls-720p",
  },
  hls_1080: {
    use: "watermark",
    agent: "/video/encode",
    preset: "hls-1080p",
  },
  hls_2160: {
    use: "watermark",
    agent: "/video/encode",
    preset: "hls-2160p",
  },
  transcode: {
    use: {
      steps: ["hls_240", "hls_360"],
      bundle_steps: true,
    },
    agent: "/video/adaptive",
    playlist_name: "playlist.m3u8",
    technique: "hls",
  },
  export: {
    use: ["watermark"],
    region: "us-east-1",
    agent: "/s3/store",
    bucket: "transcoder-output-bkt",
    key: "AKIA6OYUVTFHXGAR7QFN",
    secret: "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",
    path: "hls/{{job.id}}",
  },
  tasks: ["import", "watermark", "transcode"],
};
