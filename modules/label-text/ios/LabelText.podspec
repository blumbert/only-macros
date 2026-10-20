Pod::Spec.new do |s|
  s.name           = 'LabelText'
  s.version        = '1.0.0'
  s.summary        = 'Reads the text off a photo with Apple Vision, on the device.'
  s.description    = 'On-device text recognition for nutrition facts labels.'
  s.author         = ''
  s.homepage       = 'https://github.com/blumbert/only-macros'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
