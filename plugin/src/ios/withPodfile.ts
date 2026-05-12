import { mergeContents } from "@expo/config-plugins/build/utils/generateCode"
import { ExportedConfigWithProps, XcodeProject, } from "expo/config-plugins"
import * as fs from "fs"
import * as path from "path"
import { Logging } from "../utils/logger"
import { WithExpoIOSWidgetsProps } from ".."
import { getTargetName } from "./xcode/target"

export const withPodfile = (config: ExportedConfigWithProps<XcodeProject>, options: WithExpoIOSWidgetsProps) => {
  const targetName = `${getTargetName(config, options)}`
  const AppExtAPIOnly = options.xcode?.appExtAPI ?? false;
  const AppExtValue = AppExtAPIOnly ? 'YES' : 'No';

  const podFilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
  let podFileContent = fs.readFileSync(podFilePath).toString();

  const podInstaller = `
target '${targetName}' do
  use_expo_modules!
  config = use_native_modules!

  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',
    # An absolute path to your application root.
    :app_path => "#{Pod::Config.instance.installation_root}/..",
    :privacy_file_aggregation_enabled => podfile_properties['apple.privacyManifestAggregationEnabled'] != 'false',
  )
end
`;

  const withAppExtFix = mergeContents({
    tag: "app_ext_fix",
    src: podFileContent,
    newSrc: `    installer.target_installation_results.pod_target_installation_results
      .each do |pod_name, target_installation_result|
      target_installation_result.resource_bundle_targets.each do |resource_bundle_target|
        resource_bundle_target.build_configurations.each do |config|
          config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'NO'
        end
      end
    end`,
    anchor: `  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => podfile_properties['apple.ccacheEnabled'] == 'true',
    )
  end`,
    offset: 1,
    comment: "#",
  })

  const withAppExtFixPt2 = mergeContents({
    tag: 'fix2',
    src: withAppExtFix.contents,
    newSrc: `    installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
          config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'NO'
        end
      end`,
    anchor: /post_install do \|installer\|/,
    offset: 1,
    comment: "#",
  })

  const withPodInstaller = mergeContents({
    tag: "widget_target",
    src: withAppExtFixPt2.contents,
    newSrc: podInstaller,
    anchor: /$/,
    offset: 0,
    comment: "#",
  });

  Logging.logger.debug('Updating podfile')

  fs.writeFileSync(podFilePath, withPodInstaller.contents);

  return config;
}