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

const event2 = {
  import: {
    agent: "/video/import",
    url:
      "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  watermarked: {
    use: "import",
    agent: "/video/encode",
    watermark_alpha: 0.5,
    watermark_size: "25%",
    watermark_url: "https://transcode-input-bkt.s3.amazonaws.com/white.png",
    watermark_position: "top-right",
    height: "1600",
    width: "900",
    resize_strategy: "cover",
  },
  split: {
    use: "import",
    agent: "/video/split",
    start: 4,
    end: 24,
    every: 9,
    encode_to: "mp4",
  },
  hls_240: {
    use: "watermarked",
    agent: "/video/encode",
    preset: "hls-240p",
  },
  hls_360: {
    use: "watermarked",
    agent: "/video/encode",
    preset: "hls-360p",
  },
  hls_480: {
    use: "watermarked",
    agent: "/video/encode",
    preset: "hls-480p",
  },
  hls_720: {
    use: "watermarked",
    agent: "/video/encode",
    preset: "hls-720p",
  },
  hls_1080: {
    use: "watermarked",
    agent: "/video/encode",
    preset: "hls-1080p",
  },
  hls_2160: {
    use: "import",
    agent: "/video/encode",
    preset: "hls-2160p",
  },
  transcode: {
    use: {
      steps: ["hls_2160"],
      bundle_steps: true,
    },
    agent: "/video/adaptive",
    playlist_name: "playlist.m3u8",
    technique: "hls",
  },
  export: {
    use: ["transcode"],
    region: "us-east-1",
    agent: "/s3/store",
    bucket: "walawalabucket",
    key: "AKIA3WEDCRWOHM2LULJY",
    secret: "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",
    path: "hls/{{job.id}}",
  },
  tasks: ["import", "transcode", "export"],
};
