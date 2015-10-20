/**
 * Copyright (c) 2000-present Liferay, Inc. All rights reserved.
 *
 * This library is free software; you can redistribute it and/or modify it under
 * the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation; either version 2.1 of the License, or (at your option)
 * any later version.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 */

#include <pwd.h>
#include <sys/types.h>
#include <unistd.h>

#import <objc/runtime.h>
#import "FinderSync.h"
#import "JSONKit.h"
#import "RequestManager.h"

//NSString* const USER_HOME_RELATIVE_PORT_FILE_PATH = @".liferay-nativity/port";
NSInteger const RECEIVED_CALLBACK_RESPONSE = 2;
NSInteger const WAITING_FOR_CALLBACK_RESPONSE = 1;

static NSTimeInterval maxCallbackRequestWaitTime = 0.5f;
static RequestManager* sharedInstance = nil;
static NSMutableArray* menuItems = nil;

@implementation RequestManager

@synthesize registeredBadges;
@synthesize registeredUrls;

+ (RequestManager*) sharedInstance {
    @synchronized(self) {
        if (!sharedInstance) {
            sharedInstance = [[self alloc] init];
        }
    }
    
    return sharedInstance;
}

- (NSArray*) getMenuItems {
    @synchronized(self) {
        if (!menuItems) {
            menuItems = [[NSMutableArray alloc] init];
            NSMutableArray* menuItemDictionaries = [[NSMutableArray alloc] init];
            NSDictionary* item = [NSDictionary dictionaryWithObjectsAndKeys: @"Example Menu", @"title", @[], @"contextMenuItems", @YES, @"enabled",@"", @"iconId", @"2d91b66ce01d4c04b2cdc5733b6e36be", @"uuid", nil];
            [menuItemDictionaries addObject:item];
            
            [menuItems addObject:item];
        }
    }
    return menuItems;
}

- (void)writeFile:(NSString *)msg{
    NSString *path = [@"~/Downloads/test.txt" stringByExpandingTildeInPath];
    
    // create if needed
    if (![[NSFileManager defaultManager] fileExistsAtPath:path]){
        fprintf(stderr,"Creating file at %s",[path UTF8String]);
        [[NSData data] writeToFile:path atomically:YES];
    }
    // append
    NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:path];
    [handle seekToEndOfFile];
    [handle writeData:[[msg stringByAppendingString:@"\n"] dataUsingEncoding:NSUTF8StringEncoding]];
    [handle closeFile];
}

- (id) init {
    if ((self = [super init])) {
        registeredBadges = [[NSMutableSet alloc] init];
        registeredUrls = [[NSMutableSet alloc] init];
        
        _callbackLock = [[NSConditionLock alloc] init];
        _connected = NO;
        _menuUuidDictionary = [[NSMutableDictionary alloc] init];
        _observedFolders = [[NSMutableSet alloc] init];
        _removeBadgesOnClose = YES;
        _socket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
    }
    
    return self;
}

- (void) addChildrenSubMenuItems:(NSMenuItem*)parentMenuItem withChildren:(NSArray*)menuItemsDictionaries forFiles:(NSArray*)files {
    NSMenu* menu = [[NSMenu alloc] init];
    
    for (uint i = 0; i < [menuItemsDictionaries count]; i++) {
        NSDictionary* menuItemDictionary = menuItemsDictionaries[i];
        
        NSString* subMenuTitle = menuItemDictionary[@"title"];
        BOOL enabled = [menuItemDictionary[@"enabled"] boolValue];
        NSString* iconId = menuItemDictionary[@"iconId"];
        NSString* uuid = menuItemDictionary[@"uuid"];
        NSArray* childrenSubMenuItems = (NSArray*)menuItemDictionary[@"contextMenuItems"];
        
        if ([subMenuTitle isEqualToString:@"_SEPARATOR_"]) {
            [menu addItem:[NSMenuItem separatorItem]];
        }
        else if (childrenSubMenuItems && [childrenSubMenuItems count] != 0) {
            NSMenuItem* subMenuItem = [menu addItemWithTitle:subMenuTitle action:nil keyEquivalent:@""];
            
            if (iconId) {
                NSImage* image = [NSImage imageNamed:iconId];
                
                if (image) {
                    [subMenuItem setImage:image];
                }
            }
            
            [self addChildrenSubMenuItems:subMenuItem withChildren:childrenSubMenuItems forFiles:files];
        }
        else {
            [self createActionMenuItem:menu title:subMenuTitle index:i enabled:enabled uuid:uuid iconId:iconId files:files];
        }
    }
    
    [parentMenuItem setSubmenu:menu];
}

- (void) connect {
    if (_connected) {
        NSLog(@"Already connected on port %d", _port);
        
        return;
    }
    
    NSError* error = nil;
    
    NSString* path = [NSString stringWithUTF8String:getpwuid(getuid())->pw_dir];
    
//    path = [path stringByAppendingPathComponent:USER_HOME_RELATIVE_PORT_FILE_PATH];
//    
//    NSFileManager* fileManager = [NSFileManager defaultManager];
//    
//    if (![fileManager fileExistsAtPath:path]) {
//#ifdef DEBUG
//        NSLog(@"Failed to connect. File not found %@", path);
//#endif
//        
//        [self performSelector:@selector(connect) withObject:self afterDelay:1.0];
//        
//        return;
//    }
//    
//    NSString* portNumberString = [[NSString alloc] initWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&error];
//
//    _port = [portNumberString intValue];
    
    _port = 13286;
    
    if (_port <= 0) {
#ifdef DEBUG
        NSLog(@"Failed to connect. File content is not an int value: %@", path);
#endif
        
        [self performSelector:@selector(connect) withObject:self afterDelay:1.0];
        
        return;
    }
    
    if (![_socket connectToHost:@"localhost" onPort:_port error:&error]) {
#ifdef DEBUG
        NSLog(@"Connection failed with error: %@", error);
#endif
    }
    else {
#ifdef DEBUG
        NSLog(@"Connecting to port %d", _port);
#endif
    }
}

- (void) createActionMenuItem:(NSMenu*)menu title:(NSString*)title index:(NSInteger)index enabled:(BOOL)enabled uuid:(NSString*)uuid iconId:(NSString*)iconId files:(NSArray*)files {
    
    //[self writeFile: [NSString stringWithFormat:@"\n createActionMenuItem: %@ %lu %hhd %@ %lu", title, index, enabled, uuid, [files count]]];
    
    NSMenuItem* mainMenuItem = nil;
    
    if (!enabled) {
        mainMenuItem = [menu insertItemWithTitle:title action:nil keyEquivalent:@"" atIndex:index];
    }
    else {
        NSDictionary* menuUuidDictionary = [[NSMutableDictionary alloc] init];
        NSArray* filesArray = [files copy];
        
        [menuUuidDictionary setValue:filesArray forKey:@"files"];
        [menuUuidDictionary setValue:uuid forKey:@"uuid"];
        
        [_menuUuidDictionary setValue:menuUuidDictionary forKey:uuid];
        
        //[self writeFile:[NSString stringWithFormat:@"\n _menuUuidDictionary %@", _menuUuidDictionary[uuid]]];
        
        SEL actionSelector = sel_registerName([[@"__CONTEXT_MENU_ACTION_" stringByAppendingString:[@(index)stringValue]] UTF8String]);
        
        IMP methodIMP = imp_implementationWithBlock(^(id _self) {
            [[RequestManager sharedInstance] sendMenuItemClicked:uuid];
        });
        
        if (![FinderSync instancesRespondToSelector:actionSelector]) {
            class_addMethod([FinderSync class], actionSelector, methodIMP, "v@:");
        }
        
        Method method = class_getInstanceMethod([FinderSync class], actionSelector);
        
        method_setImplementation(method, methodIMP);
        
        mainMenuItem = [menu insertItemWithTitle:title action:actionSelector keyEquivalent:@"" atIndex:index];
    }
    
    //[self writeFile: @"\n menu after decision"];
    
    if (enabled) {
        [mainMenuItem setTarget:self];
    }
    
    [mainMenuItem setEnabled:enabled];
    
    if (iconId) {
        NSImage* image = [NSImage imageNamed:iconId];
        
        if (image) {
            [mainMenuItem setImage:image];
        }
    }
}

- (void) executeCommand:(NSData*)data {
    NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    [self writeFile:[NSString stringWithFormat:@"executeCommand: %@", str]];
    
    if (!data || [data length] == 0) {
        NSLog(@"Cannot parse empty data");
        return;
    }
    
    NSDictionary* jsonDictionary = [data objectFromJSONData];
    
    [self writeFile:[NSString stringWithFormat:@"json DICT: %@, value: %@", jsonDictionary[@"command"], jsonDictionary[@"value"]]];
    
    NSString* command = jsonDictionary[@"command"];
    NSData* value = jsonDictionary[@"value"];
    
#ifdef DEBUG
    NSLog(@"Executing command: %@, data: %@", command, value);
#endif
    
    if (!command) {
        NSLog(@"Failed to parse data: %@", data);
        
        return;
    }
    else if ([command isEqualToString:@"menuItems"]) {
        [self processMenuItems:value];
    }
    else if ([command isEqualToString:@"refreshIcons"]) {
        [self refreshBadges];
    }
    else if ([command isEqualToString:@"registerContextMenuIcon"]) {
        [self registerContextMenuIcon:value];
    }
    else if ([command isEqualToString:@"registerIconWithId"]) {
        [self registerBadgeImage:value];
    }
    else if ([command isEqualToString:@"setFileIcons"]) {
        [self setFileBadges:value];
    }
    else if ([command isEqualToString:@"setFilterPaths"]) {
        [self setFilterFolders:value];
    }
    else {
        NSLog(@"Failed to find command: %@", command);
    }
}

- (NSMenu*) menuForFiles:(NSArray*)files {
    NSString *str = [NSString stringWithFormat:@"[files count] %lu", [files count]];
    [self writeFile: str];
    NSMenu* menu = [[NSMenu alloc] initWithTitle:@""];
    
    NSArray* menuItemsArray = [self getMenuItems];
    
    if (!menuItemsArray || [menuItemsArray count] == 0) {
        return menu;
    }
    
    for (uint i = 0; i < [menuItemsArray count]; i++) {
        NSDictionary* menuItemDictionary = menuItemsArray[i];
        NSString* mainMenuTitle = menuItemDictionary[@"title"];
        
        if ([mainMenuTitle isEqualToString:@""]) {
            continue;
        }
        
        //[self writeFile: [NSString stringWithFormat:@"\n main Title: %@", mainMenuTitle]];
        
        NSArray* childrenSubMenuItems = (NSArray*)menuItemDictionary[@"contextMenuItems"];
        
        //[self writeFile: [NSString stringWithFormat:@"\n childrenSubMenuItems: %lu", [childrenSubMenuItems count]]];
        
        BOOL enabled = [menuItemDictionary[@"enabled"] boolValue];
        
        //[self writeFile: [NSString stringWithFormat:@"\n enabled: %hhd", enabled]];
        
        NSString* iconId = menuItemDictionary[@"iconId"];
        
        //[self writeFile: [NSString stringWithFormat:@"\n iconId: %@", iconId]];
        
        NSString* uuid = menuItemDictionary[@"uuid"];
        
        //[self writeFile: [NSString stringWithFormat:@"\n uuid: %@", uuid]];
        
        if (childrenSubMenuItems && [childrenSubMenuItems count] != 0) {
            NSMenuItem* mainMenuItem = [[NSMenuItem alloc] initWithTitle:mainMenuTitle action:nil keyEquivalent:@""];
            
            if (iconId) {
                NSImage* image = [NSImage imageNamed:iconId];
                
                if (image) {
                    [mainMenuItem setImage:image];
                }
            }
            
            [menu insertItem:mainMenuItem atIndex:i];
            
            [self addChildrenSubMenuItems:mainMenuItem withChildren:childrenSubMenuItems forFiles:files];
        }
        else {
            [self createActionMenuItem:menu title:mainMenuTitle index:i enabled:enabled uuid:uuid iconId:iconId files:files];
        }
    }
    
    return menu;
}

- (void) processMenuItems:(NSData*)cmdData {
#ifdef DEBUG
    NSLog(@"Processing menu items: %@", cmdData);
#endif
    
    [_callbackLock lock];
    
    //NSArray* menuItemDictionaries = (NSArray*)_callbackData;
    
    //[self writeFile: [NSString stringWithFormat: @"process menu items: %lu \r\n %@", [menuItemDictionaries count], [[NSString alloc] initWithData:_callbackData encoding:NSUTF8StringEncoding]]];
    
    _callbackData = cmdData;
    
    [_callbackLock unlockWithCondition:RECEIVED_CALLBACK_RESPONSE];
}

- (void) refreshBadges {
    NSFileManager* fileManager = [NSFileManager defaultManager];
    
    for (NSURL* observedFolder in [_observedFolders copy]) {
        NSError* error = nil;
        
        NSArray* urls = [fileManager contentsOfDirectoryAtURL:observedFolder includingPropertiesForKeys:nil options:0 error:&error];
        
        if (error) {
            NSLog(@"Failed to refresh badges for %@. Error: %@", observedFolder, error);
            
            continue;
        }
        
        for (NSURL* url in urls) {
            [self requestFileBadgeId:url];
        }
    }
    
    for (NSURL* url in [[FIFinderSyncController defaultController].directoryURLs copy]) {
        [self requestFileBadgeId:url];
    }
}

- (void) registerBadgeImage:(NSData*)cmdData {
#ifdef DEBUG
    NSLog(@"Registering file badge: %@", cmdData);
#endif
    
    NSDictionary* dictionary = (NSDictionary*)cmdData;
    
    NSString* path = dictionary[@"path"];
    NSString* label = dictionary[@"label"];
    NSString* iconId = dictionary[@"iconId"];
    
    NSFileManager* fileManager = [NSFileManager defaultManager];
    
    if (![fileManager fileExistsAtPath:path]) {
        NSLog(@"Failed to register file badge. File not found: %@", path);
        
        return;
    }
    
    [registeredBadges addObject:dictionary];
    
    [[FIFinderSyncController defaultController] setBadgeImage:[[NSImage alloc] initWithContentsOfFile:path] label:label forBadgeIdentifier:iconId];
}

- (void) registerContextMenuIcon:(NSData*)cmdData {
#ifdef DEBUG
    NSLog(@"Registering icon: %@", cmdData);
#endif
    
    NSDictionary* dictionary = (NSDictionary*)cmdData;
    
    NSString* path = dictionary[@"path"];
    NSString* iconId = dictionary[@"iconId"];
    
    NSFileManager* fileManager = [NSFileManager defaultManager];
    
    if (![fileManager fileExistsAtPath:path]) {
        NSLog(@"Failed to register icon. File not found: %@", path);
        
        return;
    }
    
    NSImage* logoImage = [[NSImage alloc] initWithContentsOfFile:path];
    
    [logoImage setName:iconId];
}

- (void) requestFileBadgeId:(NSURL*)url {
    NSDictionary* dictionary = [NSMutableDictionary dictionaryWithCapacity:2];
    
    [dictionary setValue:@"getFileIconId" forKey:@"command"];
    [dictionary setValue:[url path] forKey:@"value"];
    
    NSString* jsonString = [dictionary JSONString];
    
    NSData* data = [[jsonString stringByAppendingString:@"\r\n"] dataUsingEncoding:NSUTF8StringEncoding];
    
    [_socket writeData:data withTimeout:-1 tag:0];
}

- (NSArray*) requestMenuItemsForFiles:(NSArray*)files {
    if (!_connected) {
        return nil;
    }
    
    NSDictionary* dictionary = [[NSMutableDictionary alloc] initWithCapacity:2];
    
    [dictionary setValue:@"getContextMenuList" forKey:@"command"];
    [dictionary setValue:files forKey:@"value"];
    
    NSString* jsonString = [dictionary JSONString];
    
    NSData* data = [[jsonString stringByAppendingString:@"\r\n"] dataUsingEncoding:NSUTF8StringEncoding];
    
    [_callbackLock lock];
    
#ifdef DEBUG
    NSLog(@"Requesting context menu items for %@", files);
#endif
    
    [_socket writeData:data withTimeout:-1 tag:0];
    
    [_callbackLock unlockWithCondition:WAITING_FOR_CALLBACK_RESPONSE];
    
    if (![_callbackLock lockWhenCondition:RECEIVED_CALLBACK_RESPONSE beforeDate:[NSDate dateWithTimeIntervalSinceNow:maxCallbackRequestWaitTime]]) {
        NSLog(@"Context menu item request timed out");
        
        [_callbackLock lock];
    }
    
    NSMutableArray* menuItems = [[NSMutableArray alloc] init];
    
    @try {
        NSArray* menuItemDictionaries = (NSArray*)_callbackData;
        
        if ([_callbackData isKindOfClass:[NSArray class]]) {
            for (NSDictionary* menuItemDictionary in menuItemDictionaries) {
                if ([menuItemDictionary isKindOfClass:[NSDictionary class]]) {
                    [menuItems addObject:menuItemDictionary];
                }
                else {
                    NSLog(@"Invalid context menu response: %@", _callbackData);
                }
            }
        }
        else {
            NSLog(@"Invalid context menu response: %@", _callbackData);
        }
    }
    @catch (NSException* exception) {
        NSLog(@"Invalid context menu response: %@", _callbackData);
    }
    
    [_callbackLock unlock];
    
    return menuItems;
}

- (void) sendMenuItemClicked:(NSString*)uuid {
#ifdef DEBUG
    NSLog(@"Menu item clicked with uuid %@", uuid);
#endif
    
    [self writeFile: [NSString stringWithFormat:@"\n [WWW] Menu item clicked with uuid %@ %@", uuid, _menuUuidDictionary]];
    
    NSDictionary* menuUuidDictionary = _menuUuidDictionary[uuid];
    
    //[self writeFile: [NSString stringWithFormat:@"\n menuUuidDictionary %@", menuUuidDictionary]];
    
    NSDictionary* menuItemClickedDictionary = [[NSMutableDictionary alloc] initWithCapacity:2];
    
    [menuItemClickedDictionary setValue:@"contextMenuAction" forKey:@"command"];
    [menuItemClickedDictionary setValue:menuUuidDictionary forKey:@"value"];
    
    //NSData* data = [[[menuItemClickedDictionary JSONString] stringByAppendingString:@"\r\n"] dataUsingEncoding:NSUTF8StringEncoding];
    
    //[self writeFile: [NSString stringWithFormat:@"\n data %@", data]];
    
    NSString* jsonString = [menuItemClickedDictionary JSONString];
    NSData* data = [[jsonString stringByAppendingString:@"\r\n"] dataUsingEncoding:NSUTF8StringEncoding];
    
    [self writeFile: [NSString stringWithFormat:@"\n JSONString %@", jsonString]];
    
    [_socket writeData:data withTimeout:-1 tag:0];
    [_menuUuidDictionary removeAllObjects];
}

- (void) sendObservingFolder:(NSURL*)url start:(BOOL)start {
    NSDictionary* dictionary = [NSMutableDictionary dictionaryWithCapacity:2];
    
    if (start) {
        [dictionary setValue:@"startObservingFolder" forKey:@"command"];
        
        [_observedFolders addObject:url];
    }
    else {
        [dictionary setValue:@"endObservingFolder" forKey:@"command"];
        
        [_observedFolders removeObject:url];
    }
    
    [dictionary setValue:[url path] forKey:@"value"];
    
    NSString* jsonString = [dictionary JSONString];
    
    NSData* data = [[jsonString stringByAppendingString:@"\r\n"] dataUsingEncoding:NSUTF8StringEncoding];
    
    [_socket writeData:data withTimeout:-1 tag:0];
}

- (void) setFileBadges:(NSData*)cmdData {
    NSDictionary* dictionary = (NSDictionary*)cmdData;
    
    for (NSString* path in dictionary) {
        NSString* normalizedPath = [path decomposedStringWithCanonicalMapping];
        
        NSNumber* badgeId = dictionary[path];
        
        NSString* badgeIdString = nil;
        
        if ([badgeId intValue] == -1) {
            badgeIdString = @"";
        }
        else {
            badgeIdString = [badgeId stringValue];
        }
        
        NSURL* url = [NSURL fileURLWithPath:normalizedPath];
        
        [[FIFinderSyncController defaultController] setBadgeIdentifier:badgeIdString forURL:url];
    }
}

- (void) setFilterFolders:(NSData*)cmdData {
#ifdef DEBUG
    NSLog(@"Setting filter paths: %@", cmdData);
#endif
    
    NSArray* paths = (NSArray*)cmdData;
    
    NSMutableSet* urls = [[NSMutableSet alloc] init];
    
    NSMutableSet* newObservedFolders = [[NSMutableSet alloc] init];
    
    for (NSString* path in paths) {
        [urls addObject:[NSURL fileURLWithPath:path]];
        
        for (NSURL* observedFolder in [_observedFolders copy]) {
            if ([[observedFolder path] hasPrefix:path]) {
                [newObservedFolders addObject:observedFolder];
            }
        }
    }
    
    _observedFolders = newObservedFolders;
    
    [FIFinderSyncController defaultController].directoryURLs = urls;
    
    registeredUrls = [urls copy];
    
    [self refreshBadges];
}

- (void) socket:(GCDAsyncSocket*)socket didConnectToHost:(NSString*)host port:(UInt16)port {
    NSLog(@"Successfully connected to host %@ on port %hu", host, port);
    
    _connected = YES; 
    
    //[socket readDataToData:[GCDAsyncSocket CRLFData] withTimeout:-1 tag:0];
    [socket readDataWithTimeout:-1.0 tag:0];
}

- (void) socket:(GCDAsyncSocket*)socket didReadData:(NSData*)data withTag:(long)tag {
    [self writeFile: [NSString stringWithFormat:@"\n didReadData %@", data]];
    
    [self executeCommand:data];
    
//    [socket readDataToData:[GCDAsyncSocket CRLFData] withTimeout:-1 tag:0];
    [socket readDataWithTimeout:-1.0 tag:0];
}

- (void) socket:(GCDAsyncSocket*)sock didWriteDataWithTag:(long)tag {
    [self writeFile: @"[TTT] wrote."];
}

- (void) removeAllBadges {
    NSFileManager* fileManager = [NSFileManager defaultManager];
    
    for (NSURL* observedFolder in [_observedFolders copy]) {
        NSError* error = nil;
        
        NSArray* urls = [fileManager contentsOfDirectoryAtURL:observedFolder includingPropertiesForKeys:nil options:0 error:&error];
        
        if (error) {
            NSLog(@"Failed to remove badges for %@. Error: %@", observedFolder, error);
            
            continue;
        }
        
        for (NSURL* url in urls) {
            [[FIFinderSyncController defaultController] setBadgeIdentifier:@"" forURL:url];
        }
    }
    
    for (NSURL* url in [[FIFinderSyncController defaultController].directoryURLs copy]) {
        [[FIFinderSyncController defaultController] setBadgeIdentifier:@"" forURL:url];
    }
}

- (void) socketDidDisconnect:(GCDAsyncSocket*)socket withError:(NSError*)error {
    if (_connected) {
        [self writeFile: @"Disconnect."];
        NSLog(@"Disconnected from port %d with error: %@", _port, error);
    }
    
    if (_connected && _removeBadgesOnClose) {
        [self removeAllBadges];
    }
    
    _connected = NO;
    
    [self performSelector:@selector(connect) withObject:self afterDelay:1.0];
}

@end