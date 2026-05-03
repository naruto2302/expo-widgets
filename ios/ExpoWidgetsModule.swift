import ExpoModulesCore
import WidgetKit

public class ExpoWidgetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoWidgets")

    Function("setWidgetData") { (appGroup: String, data: [String: Any]) in
      guard let userDefaults = UserDefaults(suiteName: appGroup) else {
        return
      }
        
      for (key, value) in data {
        userDefaults.set(value, forKey: key)
      }

      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}